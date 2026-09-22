# SandLoader easy install for Windows.
# Finds Sandustry (Steam, GOG, or a standalone folder), downloads a portable
# Node.js only when the machine does not already have 18 or newer, then runs
# install.js. Git is not required. The game itself never needs this Node:
# after install, Sandustry's own Electron runs the loader.
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$GameArg,
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Enable-PrettyConsole {
  # Windows Terminal already uses Cascadia. The legacy console does not.
  if ($env:WT_SESSION) { return }
  try {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SmlnConsole {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct FontInfo {
    public int cbSize;
    public int nFont;
    public short cx;
    public short cy;
    public int family;
    public int weight;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
    public string face;
  }
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern IntPtr GetStdHandle(int n);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool SetCurrentConsoleFontEx(IntPtr h, bool max, ref FontInfo info);
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool GetConsoleMode(IntPtr h, out int mode);
  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool SetConsoleMode(IntPtr h, int mode);
}
'@ -ErrorAction Stop
    $out = [SmlnConsole]::GetStdHandle(-11)
    $font = New-Object SmlnConsole+FontInfo
    # The documented size. Marshal.SizeOf is wrong for this layout on
    # Windows PowerShell 5.1, and a wrong cbSize makes the font call fail.
    $font.cbSize = 84
    $font.family = 54
    $font.weight = 400
    $font.cy = 20
    foreach ($face in @('Cascadia Mono', 'Cascadia Code', 'Consolas')) {
      $font.face = $face
      if ([SmlnConsole]::SetCurrentConsoleFontEx($out, $false, [ref]$font)) { break }
    }
    $mode = 0
    if ([SmlnConsole]::GetConsoleMode($out, [ref]$mode)) {
      # ENABLE_VIRTUAL_TERMINAL_PROCESSING, so the colours below are real.
      [void][SmlnConsole]::SetConsoleMode($out, ($mode -bor 4))
    }
  } catch {}
  try {
    $raw = $Host.UI.RawUI
    $buf = $raw.BufferSize
    if ($buf.Width -lt 110) { $buf.Width = 110 }
    if ($buf.Height -lt 400) { $buf.Height = 400 }
    $raw.BufferSize = $buf
    $win = $raw.WindowSize
    $win.Width = [Math]::Min(100, $buf.Width)
    $win.Height = [Math]::Min(36, $raw.MaxWindowSize.Height)
    $raw.WindowSize = $win
  } catch {}
}

function Write-Banner {
  # Windows PowerShell 5.1 does not understand the `e escape, so those codes
  # were printed as the letters "e[38;2;...". Console colours go through the
  # host API instead, which works in the old console and in Windows Terminal.
  Write-Host ""
  Write-Host "  SANDLOADER" -ForegroundColor Yellow
  Write-Host "  Install for Sandustry" -ForegroundColor DarkGray
  Write-Host "  ------------------------------------------------------------" -ForegroundColor DarkGray
  Write-Host "  Steam, GOG, and standalone copies. No Git, and no separate Node.js setup." -ForegroundColor DarkGray
  Write-Host ""
}

function Write-Row([string]$label, [string]$value, [string]$kind) {
  $color = switch ($kind) { 'ok' { 'Green' } 'bad' { 'Red' } default { 'Gray' } }
  Write-Host ("  {0,-10} " -f $label) -ForegroundColor DarkYellow -NoNewline
  Write-Host $value -ForegroundColor $color
}

function Resolve-GameDir([string]$raw) {
  if (-not $raw) { return $null }
  $raw = $raw.Trim().Trim('"')
  if (-not $raw) { return $null }
  if (Test-Path -LiteralPath $raw -PathType Leaf) { return (Split-Path -Parent $raw) }
  return $raw
}

function Test-NodeOk([string]$exe) {
  if (-not $exe -or -not (Test-Path -LiteralPath $exe)) { return $false }
  try {
    $raw = & $exe -p "process.versions.node" 2>$null
    if (-not $raw) { return $false }
    return ([version]($raw.Trim())) -ge [version]'18.0.0'
  } catch { return $false }
}

function Get-PortableNode {
  $destExe = Join-Path $Root 'vendor\node\node.exe'
  if (Test-NodeOk $destExe) { return $destExe }

  Write-Row 'node' 'Downloading the official build (about 30 MB, once)...' 
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $index = Invoke-RestMethod -UseBasicParsing 'https://nodejs.org/dist/index.json'
  $picked = $index | Where-Object { $_.lts -and $_.version } | Select-Object -First 1
  if (-not $picked) { throw 'nodejs.org did not list an LTS build' }
  $ver = [string]$picked.version
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
  $name = "node-$ver-win-$arch.zip"
  $url = "https://nodejs.org/dist/$ver/$name"

  $sums = (Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/$ver/SHASUMS256.txt").Content
  $expected = $null
  foreach ($line in ($sums -split "`n")) {
    if ($line -match "^([a-f0-9]{64})\s+\*?$([regex]::Escape($name))\s*$") { $expected = $Matches[1]; break }
  }
  if (-not $expected) { throw "no checksum published for $name" }

  $tmp = Join-Path ([IO.Path]::GetTempPath()) $name
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $tmp
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $tmp).Hash.ToLowerInvariant()
  if ($actual -ne $expected.ToLowerInvariant()) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    throw 'The Node.js download failed its checksum check. Nothing was installed.'
  }

  $unpack = Join-Path ([IO.Path]::GetTempPath()) ("smln-node-" + [guid]::NewGuid().ToString('n'))
  Expand-Archive -LiteralPath $tmp -DestinationPath $unpack -Force
  $inner = Get-ChildItem -LiteralPath $unpack -Directory | Select-Object -First 1
  if (-not $inner) { throw 'the Node.js archive had no folder inside' }
  $target = Join-Path $Root 'vendor\node'
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
  New-Item -ItemType Directory -Path (Join-Path $Root 'vendor') -Force | Out-Null
  Move-Item -LiteralPath $inner.FullName -Destination $target
  Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $unpack -Recurse -Force -ErrorAction SilentlyContinue
  if (-not (Test-NodeOk (Join-Path $target 'node.exe'))) { throw 'the downloaded Node.js does not run' }
  return (Join-Path $target 'node.exe')
}

function Get-NodeVersion([string]$exe) {
  try { return (& $exe -p "process.versions.node" 2>$null).Trim() } catch { return $null }
}

function Find-Node {
  # A copy already on the PC is used only when it is 18 or newer. Anything
  # older is left untouched and a separate copy is downloaded into vendor\node.
  $candidates = @()
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $candidates += $cmd.Source }
  foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, (Join-Path $env:LOCALAPPDATA 'Programs'))) {
    if ($base) { $candidates += (Join-Path $base 'nodejs\node.exe') }
  }
  $seen = @{}
  $tooOld = $null
  foreach ($exe in $candidates) {
    if (-not $exe -or $seen[$exe]) { continue }
    $seen[$exe] = $true
    if (-not (Test-Path -LiteralPath $exe)) { continue }
    $ver = Get-NodeVersion $exe
    if (Test-NodeOk $exe) {
      Write-Row 'node' "v$ver is already installed. Not downloading." 'ok'
      return $exe
    }
    if ($ver) { $tooOld = "$ver|$exe" }
  }
  if ($tooOld) {
    $oldVer = $tooOld.Split('|')[0]
    Write-Row 'node' "v$oldVer is older than 18. Downloading a separate copy. The installed one is left as it is." 'bad'
  }
  return Get-PortableNode
}

function Find-Game([string]$node) {
  $prev = $PSNativeCommandUseErrorActionPreference
  $PSNativeCommandUseErrorActionPreference = $false
  try {
    $out = & $node -e "const l=require('./src/asar/locate'); const r=l.tryLocate(); if(!r.ok) process.exit(2); process.stdout.write(r.install.root+'|'+r.install.version);"
    if ($LASTEXITCODE -ne 0) { return $null }
    return $out
  } finally {
    $PSNativeCommandUseErrorActionPreference = $prev
  }
}

Enable-PrettyConsole
Clear-Host
Write-Banner

try {
  $node = Find-Node
  Write-Row 'using' $node 'ok'

  $given = $null
  if ($GameArg -and $GameArg.Count -gt 0) { $given = Resolve-GameDir $GameArg[0] }
  if ($given) { $env:SANDUSTRY_DIR = $given }

  $found = Find-Game $node
  if (-not $found) {
    Write-Row 'game' 'Not found automatically.' 'bad'
    Write-Host "  Paste the folder that contains Sandustry.exe"
    Write-Host "  Steam, GOG, and standalone copies all work."
    $typed = Read-Host "  folder"
    $dir = Resolve-GameDir $typed
    if ($dir) { $env:SANDUSTRY_DIR = $dir }
    $found = Find-Game $node
  }

  if (-not $found) {
    Write-Row 'game' 'Still not found. Nothing was changed.' 'bad'
    exit 1
  }

  $parts = $found.Split('|')
  Write-Row 'game' "Sandustry $($parts[1])" 'ok'
  Write-Row 'folder' $parts[0]
  Write-Host ""

  if ($CheckOnly) { exit 0 }

  & $node (Join-Path $Root 'install.js') '--no-steamcmd'
  $code = $LASTEXITCODE
  Write-Host ""
  if ($code -eq 0) {
    Write-Row 'status' 'Installed. Start Sandustry, then press ^ or F1.' 'ok'
    Write-Host "  Leave this folder where it is. The game starts the loader from here."
  } else {
    Write-Row 'status' 'Install did not finish. Read the lines above.' 'bad'
  }
  exit $code
} catch {
  Write-Host ""
  Write-Row 'status' $_.Exception.Message 'bad'
  exit 1
}
