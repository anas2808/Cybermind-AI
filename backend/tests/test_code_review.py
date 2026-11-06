import os
import unittest

# Use inert configuration so validation helpers can be tested without secrets or a live database.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key")

from fastapi import HTTPException

from app.services.code_review import (
    _parse_json,
    _replacement_is_valid,
    _resolve_evidence_line,
    _safe_text,
)


class CodeReviewValidationTests(unittest.TestCase):
    def test_valid_python_replacement_is_accepted(self):
        code = """def greet(name):
    return name.strip()
"""
        self.assertTrue(_replacement_is_valid(code, "Python"))

    def test_invalid_python_replacement_is_rejected(self):
        self.assertFalse(_replacement_is_valid("def broken(:\n    pass\n", "Python"))

    def test_non_python_is_not_executed_or_compiled(self):
        self.assertTrue(_replacement_is_valid("function { invalid javascript", "JavaScript"))

    def test_empty_and_null_byte_replacements_are_rejected(self):
        self.assertFalse(_replacement_is_valid("  ", "Python"))
        self.assertFalse(_replacement_is_valid("print('x')\x00", "Python"))

    def test_rejects_hashlib_compare_digest_api_misuse(self):
        code = """import hashlib
def verify_password(password, stored):
    return hashlib.compare_digest(password, stored)
"""
        self.assertFalse(_replacement_is_valid(code, "Python"))

    def test_rejects_general_hashes_for_password_storage(self):
        code = """import hashlib
def store_password(password):
    return hashlib.md5(password.encode()).hexdigest()
"""
        self.assertFalse(_replacement_is_valid(code, "Python"))

    def test_rejects_shell_true_subprocess_calls(self):
        code = """import subprocess
def run_command(user_input):
    return subprocess.run(user_input, shell=True)
"""
        self.assertFalse(_replacement_is_valid(code, "Python"))

    def test_auto_detect_checks_python_replacement(self):
        code = """import hashlib
def login(username, password):
    return hashlib.md5(password.encode()).hexdigest()
"""
        source = """import sqlite3
def login(username, password):
    pass
"""
        self.assertFalse(_replacement_is_valid(code, "auto-detect", source_code=source))

    def test_safe_password_hash_api_is_not_flagged_as_weak_hash(self):
        code = """import hmac
def verify_password(password, stored):
    return hmac.compare_digest(password, stored)
"""
        self.assertTrue(_replacement_is_valid(code, "Python"))

    def test_resolves_line_from_unique_exact_evidence(self):
        lines = ['API_KEY = "placeholder"', 'print(hash_password("admin123"))']
        self.assertEqual(_resolve_evidence_line('print(hash_password("admin123"))', lines), 2)

    def test_ambiguous_evidence_does_not_guess_line(self):
        lines = ["return value", "return value"]
        self.assertIsNone(_resolve_evidence_line("return value", lines))

    def test_parse_plain_json(self):
        self.assertEqual(
            _parse_json('{"findings": [], "improved_code": null}'),
            {"findings": [], "improved_code": None},
        )

    def test_parse_fenced_json(self):
        self.assertEqual(
            _parse_json(' ```json\n{"findings": []}\n``` '),
            {"findings": []},
        )

    def test_invalid_json_returns_gateway_error(self):
        with self.assertRaises(HTTPException) as caught:
            _parse_json("not json")
        self.assertEqual(caught.exception.status_code, 502)

    def test_json_array_is_rejected(self):
        with self.assertRaises(HTTPException):
            _parse_json("[]")

    def test_safe_text_bounds_and_defaults(self):
        self.assertEqual(_safe_text("  abc  ", "default", 2), "ab")
        self.assertEqual(_safe_text(None, "default", 2), "default")


if __name__ == "__main__":
    unittest.main()
