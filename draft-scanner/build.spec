# PyInstaller spec for a single portable draft-scanner.exe — bundles
# Python, all dependencies, and a trimmed copy of Tesseract OCR, so an
# end user just downloads and double-clicks the .exe. No Python install,
# no separate Tesseract install, no pip.
#
# Build with:
#   pyinstaller build.spec
# Output: dist/draft-scanner.exe
#
# Prerequisite (one-time, before building — not needed by end users who
# just run the built .exe): stage a trimmed Tesseract copy at
# _tesseract_bundle/ next to this spec file. See README.md's "Building
# the .exe" section for the exact staging commands — only tesseract.exe,
# its DLLs, and tessdata/eng.traineddata are needed (the full Tesseract
# install also has Java training tools and script-detection data this
# app never uses, dropped to keep the .exe smaller).

import os

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('_tesseract_bundle', 'Tesseract-OCR'),
    ],
    hiddenimports=['win32timezone'],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='draft-scanner',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
