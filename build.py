"""
FreelanceCalc Static Website Builder

Reads:
    data/platforms.json
    data/pages.json
    templates/

Generates:
    dist/
"""

import json
import shutil
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape


# ==========================================
# 1. PROJECT PATHS
# ==========================================

ROOT = Path(__file__).resolve().parent

DATA_DIR = ROOT / "data"
TEMPLATE_DIR = ROOT / "templates"
STATIC_DIR = ROOT / "static"
DIST_DIR = ROOT / "dist"

PLATFORMS_FILE = DATA_DIR / "platforms.json"
PAGES_FILE = DATA_DIR / "pages.json"


# ==========================================
# 2. LOAD JSON DATA
# ==========================================

def load_json(file_path):

    if not file_path.exists():
        raise FileNotFoundError(
            f"Required file not found: {file_path}"
        )

    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)


# ==========================================
# 3. PREPARE PAGE DATA
# ==========================================

def prepare_page(page):

    page = dict(page)

    page["title"] = (
        page.get("title")
        or page.get("seo_title")
        or page.get("h1")
        or "Freelance Payment Guide"
    )

    page["meta_description"] = (
        page.get("meta_description")
        or page.get("seo_description")
        or page.get("description")
        or ""
    )

    page["h1"] = (
        page.get("h1")
        or page["title"]
    )

    page["intro"] = (
        page.get("intro")
        or ""
    )

    page["faqs"] = (
        page.get("faqs")
        or []
    )

    page["calculator_type"] = (
        page.get("calculator_type")
        or "none"
    )

    return page


# ==========================================
# 4. CREATE JINJA ENVIRONMENT
# ==========================================

def create_environment():

    return Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True
    )


# ==========================================
# 5. COPY STATIC FILES AND DATA
# ==========================================

def copy_project_files():

    if STATIC_DIR.exists():

        shutil.copytree(
            STATIC_DIR,
            DIST_DIR / "static",
            dirs_exist_ok=True
        )

    shutil.copytree(
        DATA_DIR,
        DIST_DIR / "data",
        dirs_exist_ok=True
    )


# ==========================================
# 6. BUILD MAIN CALCULATOR PAGE
# ==========================================

def build_homepage(environment):

    template = environment.get_template(
        "calculator.html"
    )

    html = template.render()

    output_file = DIST_DIR / "index.html"

    output_file.write_text(
        html,
        encoding="utf-8"
    )

    print("Built: index.html")


# ==========================================
# 7. BUILD SEO PAGES
# ==========================================

def build_seo_pages(environment, pages_data):

    template = environment.get_template(
        "static_page.html"
    )

    if isinstance(pages_data, dict):
        pages = pages_data.get("pages", [])
    else:
        pages = pages_data

    if not isinstance(pages, list):
        raise ValueError(
            "pages.json must contain a list of pages."
        )

    page_count = 0

    for original_page in pages:

        if original_page.get("enabled", True) is False:
            continue

        page = prepare_page(original_page)

        slug = (
            page.get("slug")
            or page.get("id")
        )

        if not slug:
            print("Skipped page without a slug.")
            continue

        # Prevent unsafe output paths.

        if (
            not isinstance(slug, str)
            or "/" in slug
            or "\\" in slug
            or slug in (".", "..")
        ):
            raise ValueError(
                f"Invalid page slug: {slug}"
            )

        html = template.render(page=page)

        output_directory = DIST_DIR / slug

        output_directory.mkdir(
            parents=True,
            exist_ok=True
        )

        output_file = output_directory / "index.html"

        output_file.write_text(
            html,
            encoding="utf-8"
        )

        print(f"Built: {slug}/index.html")

        page_count += 1

    print(f"\nSEO pages generated: {page_count}")


# ==========================================
# 8. MAIN BUILD FUNCTION
# ==========================================

def main():

    print("\n================================")
    print(" FREELANCECALC WEBSITE BUILDER")
    print("================================\n")

    # Check required folders.

    for folder in [DATA_DIR, TEMPLATE_DIR, STATIC_DIR]:
        if not folder.exists():
            raise FileNotFoundError(
                f"Required folder missing: {folder}"
            )

    # Load data.

    platforms_data = load_json(PLATFORMS_FILE)
    pages_data = load_json(PAGES_FILE)

    if not isinstance(platforms_data, dict):
        raise ValueError(
            "platforms.json must contain a JSON object."
        )

    if not isinstance(platforms_data.get("platforms"), list):
        raise ValueError(
            "platforms.json must contain a platforms list."
        )

    # Prepare output directory.

    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)

    DIST_DIR.mkdir(parents=True)

    # Set up Jinja.

    environment = create_environment()

    # Copy public assets and JSON data.

    copy_project_files()

    # Build pages.

    build_homepage(environment)

    build_seo_pages(environment, pages_data)

    print("\n================================")
    print(" BUILD COMPLETED SUCCESSFULLY!")
    print(" Output folder: dist/")
    print("================================\n")


# ==========================================
# 9. RUN BUILDER
# ==========================================

if __name__ == "__main__":

    try:
        main()

    except Exception as error:

        print("\nBUILD FAILED!")
        print("Reason:", error)

        raise