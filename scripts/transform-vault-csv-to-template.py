#!/usr/bin/env python3
"""
transform-vault-csv-to-template.py

Transforms a vault slot map CSV into the format expected by
POST /api/templates/import (templateCsvProcessor.ts).

Usage:
  python3 scripts/transform-vault-csv-to-template.py \
    --style glass-pool-spigots \
    --template-id 01-pool-spigots \
    --input  <vault-root>/verticals/barrier-hub/catalogue/01-calculator-mapping/csv/glass-pool-spigots.csv \
    --output imports/01-pool-spigots-import.csv \
    --vault-root <path-to-eco-knowledge>
"""

import argparse
import csv
import re
import sys
from pathlib import Path

OUTPUT_COLUMNS = [
    "variable_type", "label", "field_type",
    "min", "max", "step", "default_value",
    "options", "enabled", "slot_prefix", "size_mm",
    "product_sku", "product_description", "product_price", "notes",
]

# ── Finish expansion maps ────────────────────────────────────────────────────
FINISH_EXPANSIONS = {
    "MAD-DR":   ["P", "S", "B", "MW"],
    "INS-DR":   ["SG", "B", "W"],
    "LS-DR":    ["P", "S", "B"],
    "RIO-DR":   ["P", "S", "MW"],
    "MAD-HDC":  ["P", "S", "B", "MW"],
    "MAD-SDC":  ["P", "S", "B", "MW"],
    "INS-HDC":  ["SG", "B", "W"],
    "RIO-HDC":  ["P", "S", "MW"],
}

FINISH_LABELS = {
    "P": "Polish", "S": "Satin", "B": "Matt Black",
    "MW": "Matt White", "SG": "Silver Grey", "W": "White",
}

# Slot names whose product rows are expanded from csv_tabs instead of the slot map
PANEL_PATTERN_SLOT_NAMES = {"standard-panel", "hinge-panel-mr", "hinge-panel-polaris"}


def parse_args():
    p = argparse.ArgumentParser(description="Vault slot map → template CSV transform")
    p.add_argument("--style", required=True, help="Style code, e.g. glass-pool-spigots")
    p.add_argument("--template-id", required=True, help="Template ID, e.g. 01-pool-spigots")
    p.add_argument("--input", required=True, help="Path to vault slot map CSV")
    p.add_argument("--output", required=True, help="Path for output template CSV")
    p.add_argument("--vault-root", required=True, help="Path to eco-knowledge root")
    return p.parse_args()


def load_panel_data(vault_root: str) -> dict:
    """Load 12N-/12NH-/12NPH-/12NRP- SKU data from glass_pool_fencing.csv."""
    csv_path = Path(vault_root) / "verticals/barrier-hub/catalogue/csv_tabs/glass_pool_fencing.csv"
    panels = {}
    if not csv_path.exists():
        print(f"  WARNING: csv_tabs not found at {csv_path} — pattern expansion will be skipped", file=sys.stderr)
        return panels
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sku = row.get("sku", "").strip()
            if sku.startswith(("12N-", "12NH-", "12NPH-", "12NRP-")):
                panels[sku] = {
                    "description": row.get("description", "").strip(),
                    "cost": row.get("cost_aud_ex_gst", "").strip(),
                }
    return panels


def extract_size_mm(sku: str) -> int:
    """Extract numeric width/height from SKU suffix, e.g. 12N-1200 → 1200."""
    m = re.search(r"-(\d{3,4})(?:HT)?$", sku)
    return int(m.group(1)) if m else 0


def parse_number_options(opts: str) -> tuple:
    """Parse 'min X, max Y, step Z (mm)' → (min, max, step) as strings."""
    m = re.search(r"min\s+(\d+).*?max\s+(\d+).*?step\s+(\d+)", opts, re.IGNORECASE)
    if m:
        return m.group(1), m.group(2), m.group(3)
    return "", "", ""


def clean_price(raw: str) -> str:
    """Strip $ signs and whitespace from price strings."""
    return raw.replace("$", "").strip()


def make_product_row(variable_type, label, sku, description, price, slot_prefix, size_mm, notes=""):
    return {
        "variable_type": variable_type,
        "label": label or description,
        "field_type": "product",
        "min": "", "max": "", "step": "", "default_value": "",
        "options": "",
        "enabled": "",
        "slot_prefix": slot_prefix,
        "size_mm": str(size_mm) if size_mm else "",
        "product_sku": sku,
        "product_description": description,
        "product_price": clean_price(price),
        "notes": notes,
    }


def expand_finish_pattern(slot_name: str, sku_pattern: str, base_label: str, notes: str) -> list:
    """Expand 'MAD-DR-{finish}' into 4 individual rows."""
    prefix = sku_pattern.replace("-{finish}", "")
    finishes = FINISH_EXPANSIONS.get(prefix)
    if not finishes:
        return []
    rows = []
    for fin in finishes:
        sku = f"{prefix}-{fin}"
        fin_label = FINISH_LABELS.get(fin, fin)
        description = f"{base_label} — {fin_label}"
        rows.append(make_product_row(slot_name, description, sku, description, "", slot_name, 0, notes))
    return rows


def expand_panels_from_csv_tabs(slot_name: str, sku_prefix: str, panel_data: dict) -> list:
    """Expand pattern rows using real SKUs from csv_tabs."""
    rows = []
    for sku, info in sorted(panel_data.items()):
        if sku.startswith(sku_prefix):
            size_mm = extract_size_mm(sku)
            rows.append(make_product_row(
                slot_name,
                info["description"],
                sku,
                info["description"],
                info["cost"],  # cost price — operator sets retail later
                slot_name,
                size_mm,
            ))
    return rows


def transform(input_path: str, panel_data: dict) -> tuple:
    output_rows = []
    stats = {
        "input_total": 0,
        "skipped_comment": 0,
        "skipped_empty": 0,
        "skipped_locked": 0,
        "skipped_auto": 0,
        "skipped_pattern_placeholder": 0,
        "skipped_included_placeholder": 0,
        "expansions": {},   # pattern → count
        "blank_price_rows": [],
        "first_10_input": [],
    }

    # Track which panel pattern expansions have been emitted
    emitted_expansions = set()

    with open(input_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for raw_row in reader:
            stats["input_total"] += 1

            # Normalise — strip all values
            row = {k: (v or "").strip() for k, v in raw_row.items()}
            slot_name = row.get("slot_name", "")
            slot_type = row.get("slot_type", "")
            slot_default = row.get("slot_default", "")
            slot_options = row.get("slot_options", "")
            sku = row.get("sku", "")
            sku_variant = row.get("sku_variant", "")
            retail = row.get("retail_aud_ex_gst", "")
            notes = row.get("notes", "")

            # Capture first 10 input rows for sample diff
            if len(stats["first_10_input"]) < 10:
                stats["first_10_input"].append(dict(row))

            # ── Skip: comment rows ─────────────────────────────────────────
            if slot_name.startswith("#") or slot_name.startswith('"#'):
                stats["skipped_comment"] += 1
                continue

            # ── Skip: empty rows ──────────────────────────────────────────
            if not slot_name and not sku:
                stats["skipped_empty"] += 1
                continue

            # ── Skip: locked type ─────────────────────────────────────────
            if slot_type == "locked":
                stats["skipped_locked"] += 1
                continue

            # ── Skip: auto type ──────────────────────────────────────────
            if slot_type == "auto":
                stats["skipped_auto"] += 1
                continue

            # ── Skip: (included) placeholder ─────────────────────────────
            if sku == "(included)":
                stats["skipped_included_placeholder"] += 1
                continue

            # ── Pattern placeholder rows: expand from csv_tabs ───────────
            if slot_name in PANEL_PATTERN_SLOT_NAMES and "{" in sku:
                stats["skipped_pattern_placeholder"] += 1
                # Emit expansion once per slot_name
                if slot_name not in emitted_expansions:
                    emitted_expansions.add(slot_name)
                    prefix_map = {
                        "standard-panel":     "12N-",
                        "hinge-panel-mr":     "12NH-",
                        "hinge-panel-polaris":"12NPH-",
                    }
                    prefix = prefix_map[slot_name]
                    expanded = expand_panels_from_csv_tabs(slot_name, prefix, panel_data)
                    output_rows.extend(expanded)
                    stats["expansions"][f"{slot_name} ({prefix}*)"] = len(expanded)
                continue

            # ── {finish} pattern expansion ────────────────────────────────
            if "{finish}" in sku:
                expanded = expand_finish_pattern(slot_name, sku, sku_variant, notes)
                if expanded:
                    output_rows.extend(expanded)
                    stats["expansions"][sku] = len(expanded)
                continue

            # ── Determine field_type ──────────────────────────────────────
            if sku and "{" not in sku:
                field_type = "product"
            elif slot_type == "number":
                field_type = "number"
            elif slot_type == "enum":
                field_type = "select"
            elif slot_type == "toggle":
                field_type = "boolean"
            else:
                # No SKU + no usable type → skip
                stats["skipped_empty"] += 1
                continue

            # ── Build output row ──────────────────────────────────────────
            label = sku_variant if sku_variant else slot_name.replace("-", " ").title()

            if field_type == "product":
                size_mm = extract_size_mm(sku)
                slot_prefix = slot_name if size_mm == 0 else ""
                price = clean_price(retail)
                out = make_product_row(slot_name, label, sku, label, price, slot_prefix, size_mm, notes)
                if not price:
                    stats["blank_price_rows"].append(sku)

            elif field_type == "number":
                mn, mx, st = parse_number_options(slot_options)
                out = {
                    "variable_type": slot_name,
                    "label": label,
                    "field_type": "number",
                    "min": mn, "max": mx, "step": st,
                    "default_value": slot_default,
                    "options": "", "enabled": "",
                    "slot_prefix": "", "size_mm": "",
                    "product_sku": "", "product_description": "", "product_price": "",
                    "notes": notes,
                }

            elif field_type == "select":
                out = {
                    "variable_type": slot_name,
                    "label": label,
                    "field_type": "select",
                    "min": "", "max": "", "step": "",
                    "default_value": slot_default,
                    "options": slot_options,
                    "enabled": "",
                    "slot_prefix": "", "size_mm": "",
                    "product_sku": "", "product_description": "", "product_price": "",
                    "notes": notes,
                }

            else:  # boolean
                out = {
                    "variable_type": slot_name,
                    "label": label,
                    "field_type": "boolean",
                    "min": "", "max": "", "step": "",
                    "default_value": "true" if slot_default.lower() in ("on", "true", "yes") else "false",
                    "options": "", "enabled": "",
                    "slot_prefix": "", "size_mm": "",
                    "product_sku": "", "product_description": "", "product_price": "",
                    "notes": notes,
                }

            output_rows.append(out)

    return output_rows, stats


def write_output(output_path: str, rows: list):
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def print_report(stats: dict, output_rows: list, style: str, template_id: str):
    print(f"\n{'='*60}")
    print(f"  Transform: {style} → {template_id}")
    print(f"{'='*60}")
    print(f"  Input rows read:          {stats['input_total']}")
    print(f"  Output rows produced:     {len(output_rows)}")
    print()
    print(f"  Skipped:")
    print(f"    Comment rows:           {stats['skipped_comment']}")
    print(f"    Empty rows:             {stats['skipped_empty']}")
    print(f"    Locked type:            {stats['skipped_locked']}")
    print(f"    Auto type:              {stats['skipped_auto']}")
    print(f"    Pattern placeholders:   {stats['skipped_pattern_placeholder']}")
    print(f"    (included) placeholder: {stats['skipped_included_placeholder']}")
    print()
    print(f"  Pattern expansions:")
    for pattern, count in stats["expansions"].items():
        print(f"    {pattern:<40} → {count} rows")
    print()
    print(f"  Rows with blank product_price (operator sets retail later): {len(stats['blank_price_rows'])}")
    if stats["blank_price_rows"]:
        for sku in stats["blank_price_rows"][:10]:
            print(f"    {sku}")
        if len(stats["blank_price_rows"]) > 10:
            print(f"    ... and {len(stats['blank_price_rows']) - 10} more")
    print()
    # Count by field_type
    type_counts = {}
    for r in output_rows:
        t = r.get("field_type", "?")
        type_counts[t] = type_counts.get(t, 0) + 1
    print(f"  Output by field_type:")
    for t, c in sorted(type_counts.items()):
        print(f"    {t:<12} {c}")
    print(f"{'='*60}\n")


def main():
    args = parse_args()

    print(f"Loading csv_tabs panel data from vault...")
    panel_data = load_panel_data(args.vault_root)
    print(f"  Loaded {len(panel_data)} panel SKUs from glass_pool_fencing.csv")

    print(f"Transforming {args.input}...")
    output_rows, stats = transform(args.input, panel_data)

    print(f"Writing {len(output_rows)} rows to {args.output}...")
    write_output(args.output, output_rows)

    print_report(stats, output_rows, args.style, args.template_id)
    print(f"Done. Output: {args.output}")


if __name__ == "__main__":
    main()
