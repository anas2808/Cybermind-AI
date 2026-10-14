#!/usr/bin/env python3
"""Offline, conservative triage for CyberMind AI Windows Event Collector exports."""
import argparse
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path

def normalize_message(value):
    text = str(value or "").strip().lower()
    text = re.sub(r"\\s+", " ", text)
    text = re.sub(r"0x[0-9a-f]+", "<hex>", text)
    text = re.sub(r"\\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\\b", "<guid>", text)
    return text

def parse_time(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None

def classify(events):
    first = events[0]
    event_id = str(first.get("event_id", ""))
    log_name = str(first.get("log_name", ""))
    messages = " ".join(str(event.get("message") or "") for event in events).lower()
    count = len(events)
    if event_id == "5038":
        if count >= 3:
            return "MEDIUM", "Repeated Code Integrity warning", "Repeated hash-validation warnings merit checking the affected file, signer, and nearby events. This is not proof of malware."
        return "LOW", "Code Integrity warning", "An isolated hash-validation warning is not proof of malware; verify the file and signer if unexpected."
    if log_name.lower() == "security" and event_id == "4625":
        if count >= 20:
            return "MEDIUM", "Repeated failed logons", "Check account names, source addresses, logon types, and the time window. Count alone does not confirm brute force."
        if count >= 5:
            return "LOW", "Multiple failed logons", "Review whether failures cluster around one account or source; mistyped credentials are also possible."
        return "INFORMATIONAL", "Failed logon", "A small number of failed logons is common; review surrounding context before escalating."
    if log_name.lower() == "security" and event_id == "1102":
        return "HIGH", "Security audit log cleared", "Verify who cleared the Security audit log, whether it was authorized, and what events preceded it."
    level = str(first.get("level") or "").lower()
    if any(term in messages for term in ("malware detected", "ransomware", "credential theft")):
        return "MEDIUM", "Security wording requires validation", "Validate the full event and related evidence; keyword matching is not confirmation."
    if level in ("critical", "error"):
        return "LOW", "Operational error", "The event level alone does not establish a security threat; check service or application impact."
    if level in ("warning", "warn"):
        return "INFORMATIONAL", "Operational warning", "Review if this coincides with other unusual events or user-visible impact."
    return "INFORMATIONAL", "Routine event", "This event group alone does not support a strong security conclusion."

def group_events(events):
    grouped = defaultdict(list)
    for event in events:
        key = (str(event.get("log_name") or ""), str(event.get("provider") or ""), str(event.get("event_id") or ""), normalize_message(event.get("message")))
        grouped[key].append(event)
    results = []
    for key, items in grouped.items():
        items.sort(key=lambda item: str(item.get("time_created") or ""))
        priority, title, rationale = classify(items)
        times = [parse_time(item.get("time_created")) for item in items]
        times = [value for value in times if value is not None]
        results.append({
            "log_name": key[0], "provider": key[1], "event_id": key[2],
            "message": str(items[0].get("message") or "(No message provided)"),
            "count": len(items), "priority": priority, "title": title, "rationale": rationale,
            "first_seen": min(times).isoformat() if times else None,
            "last_seen": max(times).isoformat() if times else None,
            "record_ids": [str(item.get("record_id")) for item in items if item.get("record_id") is not None],
        })
    ranks = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "INFORMATIONAL": 3}
    return sorted(results, key=lambda item: (ranks[item["priority"]], -item["count"], item["log_name"], item["event_id"]))

def render(data, groups):
    counts = {level: sum(group["priority"] == level for group in groups) for level in ("HIGH", "MEDIUM", "LOW", "INFORMATIONAL")}
    lines = ["# CyberMind AI — Offline Windows Event Triage", "",
             "- Computer: " + str(data.get("computer_name") or "Unknown"),
             "- Collected at (UTC): " + str(data.get("collected_at") or "Unknown"),
             "- Raw events: " + str(data.get("event_count", len(data.get("events", [])))),
             "- Unique event groups: " + str(len(groups)),
             "- Collection errors: " + str(len(data.get("collection_errors") or [])), "",
             "## Triage overview", "", "| Review priority | Groups |", "|---|---:|"]
    for level, count in counts.items():
        lines.append("| " + level + " | " + str(count) + " |")
    lines.extend(["", "> Heuristic review priorities are not proof of compromise. The collector currently reads System and Application logs. No data is uploaded by this script.", "", "## Event groups", ""])
    if not groups:
        lines.append("No events were present in the input export.")
    for index, group in enumerate(groups, 1):
        lines.extend(["### " + str(index) + ". " + group["title"] + " — " + group["priority"],
                      "", "- Log: " + (group["log_name"] or "Unknown"),
                      "- Provider: " + (group["provider"] or "Unknown"),
                      "- Event ID: " + (group["event_id"] or "Unknown"),
                      "- Repeated count: " + str(group["count"]),
                      "- First seen: " + str(group["first_seen"] or "Not available"),
                      "- Last seen: " + str(group["last_seen"] or "Not available"),
                      "- Record IDs: " + (", ".join(group["record_ids"][:20]) or "Not available"),
                      "- Why prioritized: " + group["rationale"], "", "**Example event message**", "", "    " + group["message"].replace("\\n", " "), ""])
    errors = data.get("collection_errors") or []
    if errors:
        lines.extend(["## Collection warnings", ""] + ["- " + str(error) for error in errors] + [""])
    lines.extend(["## Validation checklist", "",
                  "1. Review HIGH and MEDIUM groups against the original Event Viewer entries.",
                  "2. Check nearby events and whether approved maintenance explains the activity.",
                  "3. Do not treat event level, keyword matches, or repeated messages alone as proof of an attack.",
                  "4. Similar events with different message text may remain separate groups.", ""])
    return "\\n".join(lines)

def main():
    parser = argparse.ArgumentParser(description="Group repeated Windows events and create a local triage report.")
    parser.add_argument("input", nargs="?", default="windows_collector/output/windows_events.json")
    parser.add_argument("-o", "--output", default=None)
    args = parser.parse_args()
    source = Path(args.input)
    if not source.is_file():
        parser.error("Input file not found: " + str(source) + ". Run collect_events.ps1 first.")
    try:
        data = json.loads(source.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        parser.error("Could not read valid JSON: " + str(exc))
    if not isinstance(data, dict) or not isinstance(data.get("events", []), list):
        parser.error("Input must contain an events array from the CyberMind collector.")
    events = [event for event in data.get("events", []) if isinstance(event, dict)]
    groups = group_events(events)
    output = Path(args.output) if args.output else source.with_name("windows_triage_report.md")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(render(data, groups), encoding="utf-8")
    counts = {level: sum(group["priority"] == level for group in groups) for level in ("HIGH", "MEDIUM", "LOW", "INFORMATIONAL")}
    print("CyberMind AI offline triage complete")
    print("Raw events: " + str(len(events)) + " | Event groups: " + str(len(groups)))
    print("Priorities: " + ", ".join(level + " " + str(count) for level, count in counts.items()))
    print("Report saved locally: " + str(output.resolve()))
    print("No logs were uploaded or transmitted.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())