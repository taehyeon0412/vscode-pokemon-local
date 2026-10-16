#!/usr/bin/env python3
"""내 PC 전용 vscode-pokemon — extension/ 을 vsix 로 묶어 VS Code 에 설치 (맥 · 윈도우 · 리눅스)

  python3 install.py        (윈도우는 python install.py)

수정 · 포켓몬 추가 후 다시 실행. 끝나면 VS Code 에서 "Developer: Reload Window".
묶은 파일은 dist/ 에 남음 (VS Code 없이 다른 데서 설치할 때 code --install-extension 으로).
"""
import json
import os
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.join(HERE, "extension")

CONTENT_TYPES = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".map" ContentType="application/json"/>
  <Default Extension=".md" ContentType="text/markdown"/>
  <Default Extension=".txt" ContentType="text/plain"/>
  <Default Extension=".css" ContentType="text/css"/>
  <Default Extension=".svg" ContentType="image/svg+xml"/>
  <Default Extension=".png" ContentType="image/png"/>
  <Default Extension=".gif" ContentType="image/gif"/>
  <Default Extension=".ttf" ContentType="font/ttf"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>
"""

MANIFEST = """<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="{name}" Version="{version}" Publisher="{publisher}"/>
    <DisplayName>VS Code Pokemon (내 PC)</DisplayName>
    <Description xml:space="preserve">Pokémon for your VS Code — 내 PC 전용 수정본</Description>
    <Categories>Other</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{engine}"/>
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
  </Assets>
</PackageManifest>
"""


def code_cli():
    # PATH 에 있으면 그것, 없으면 운영체제별 기본 설치 위치
    found = shutil.which("code")
    if found:
        return found
    candidates = [
        "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd"),
        r"C:\Program Files\Microsoft VS Code\bin\code.cmd",
        "/usr/share/code/bin/code",
        "/snap/bin/code",
    ]
    return next((c for c in candidates if os.path.exists(c)), None)


def build():
    pkg = json.load(open(os.path.join(EXT, "package.json"), encoding="utf-8"))
    os.makedirs(os.path.join(HERE, "dist"), exist_ok=True)
    vsix = os.path.join(HERE, "dist", f"{pkg['publisher']}.{pkg['name']}-{pkg['version']}.vsix")
    with zipfile.ZipFile(vsix, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr(
            "extension.vsixmanifest",
            MANIFEST.format(name=pkg["name"], version=pkg["version"], publisher=pkg["publisher"], engine=pkg["engines"]["vscode"]),
        )
        for root, dirs, files in os.walk(EXT):
            dirs[:] = [d for d in dirs if d != "__pycache__"]
            for f in files:
                if f == ".DS_Store":
                    continue
                path = os.path.join(root, f)
                z.write(path, "extension/" + os.path.relpath(path, EXT).replace(os.sep, "/"))
    return vsix


def main():
    vsix = build()
    code = code_cli()
    if not code:
        sys.exit(f"VS Code 명령(code)을 못 찾음 — 직접 설치: code --install-extension \"{vsix}\"")
    subprocess.run([code, "--install-extension", vsix, "--force"], check=True)
    print('VS Code 에서 "Developer: Reload Window" 를 실행하면 반영됩니다.')


if __name__ == "__main__":
    main()
