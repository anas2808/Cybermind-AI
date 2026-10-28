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
