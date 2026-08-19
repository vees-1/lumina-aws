#!/usr/bin/env python3
import os
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BUILD_DIR = ROOT_DIR / "build" / "lambda_package"
ZIP_PATH = ROOT_DIR / "build" / "lambda.zip"

def package():
    print("📦 Building AWS Lambda Deployment Package...")
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    print("📥 Installing dependencies into package directory...")
    subprocess.run([
        "pip", "install",
        "--target", str(BUILD_DIR),
        "--platform", "manylinux2014_x86_64",
        "--only-binary=:all:",
        "--python-version", "3.11",
        "fastapi", "mangum", "sqlmodel", "pydantic", "python-dotenv", "boto3", "pyjwt[crypto]", "httpx", "pillow", "pyhpo", "reportlab", "python-multipart", "pypdf", "lxml", "groq"
    ], check=True)

    print("📄 Copying application code & data...")
    # Copy apps/api
    api_dest = BUILD_DIR / "api"
    shutil.copytree(ROOT_DIR / "apps" / "api" / "api", api_dest, dirs_exist_ok=True)
    shutil.copy(ROOT_DIR / "apps" / "api" / "main.py", BUILD_DIR / "main.py")

    # Copy packages
    packages_dir = ROOT_DIR / "packages"
    for pkg in ["ingest", "scoring", "extractors"]:
        pkg_src = packages_dir / pkg
        if pkg_src.exists():
            shutil.copytree(pkg_src, BUILD_DIR / pkg, dirs_exist_ok=True)

    # Copy database
    data_dest = BUILD_DIR / "data"
    data_dest.mkdir(exist_ok=True)
    orpha_db = ROOT_DIR / "data" / "orpha.sqlite"
    if orpha_db.exists():
        shutil.copy(orpha_db, data_dest / "orpha.sqlite")

    print(f"🤐 Zipping deployment package into {ZIP_PATH}...")
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(BUILD_DIR):
            for f in files:
                full_path = Path(root) / f
                arc_name = full_path.relative_to(BUILD_DIR)
                z.write(full_path, arc_name)

    zip_mb = ZIP_PATH.stat().st_size / (1024 * 1024)
    print(f"✅ Lambda package created successfully! Size: {zip_mb:.2f} MB")

if __name__ == "__main__":
    package()
