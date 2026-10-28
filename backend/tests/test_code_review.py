import unittest

from fastapi import HTTPException

from app.services.code_review import _parse_json, _replacement_is_valid, _safe_text


class CodeReviewValidationTests(unittest.TestCase):
    def test_valid_python_replacement_is_accepted(self):
        self.assertTrue(_replacement_is_valid("def greet(name):\n    return name.strip()\n", "Python"))

    def test_invalid_python_replacement_is_rejected(self):
        self.assertFalse(_replacement_is_valid("def broken(:\n    pass\n", "Python"))

    def test_non_python_is_not_executed_or_compiled(self):
        self.assertTrue(_replacement_is_valid("function { invalid javascript", "JavaScript"))

    def test_empty_and_null_byte_replacements_are_rejected(self):
        self.assertFalse(_replacement_is_valid("  ", "Python"))
        self.assertFalse(_replacement_is_valid("print('x')\x00", "Python"))


    def test_rejects_hashlib_compare_digest_api_misuse(self):
        code = "import hashlib\\ndef verify_password(password, stored):\\n    return hashlib.compare_digest(password, stored)\\n"
        self.assertFalse(_replacement_is_valid(code, "Python"))

    def test_rejects_general_hashes_for_password_storage(self):
        code = "import hashlib\\ndef store_password(password):\\n    return hashlib.md5(password.encode()).hexdigest()\\n"
        self.assertFalse(_replacement_is_valid(code, "Python"))

    def test_rejects_shell_true_subprocess_calls(self):
        code = "import subprocess\\ndef run_command(user_input):\\n    return subprocess.run(user_input, shell=True)\\n"
        self.assertFalse(_replacement_is_valid(code, "Python"))

    def test_auto_detect_checks_python_replacement(self):
        code = "import hashlib\\ndef login(username, password):\\n    return hashlib.md5(password.encode()).hexdigest()\\n"
        self.assertFalse(_replacement_is_valid(code, "auto-detect", source_code="import sqlite3\\ndef login(username, password):\\n    pass\\n"))

    def test_safe_password_hash_api_is_not_flagged_as_weak_hash(self):
        code = "import hmac\\ndef verify_password(password, stored):\\n    return hmac.compare_digest(password, stored)\\n"
        self.assertTrue(_replacement_is_valid(code, "Python"))

    def test_parse_plain_json(self):
        self.assertEqual(_parse_json('{"findings": [], "improved_code": null}'), {
            "findings": [], "improved_code": None
        })

    def test_parse_fenced_json(self):
        self.assertEqual(_parse_json('```json\n{"findings": []}\n```'), {"findings": []})

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
