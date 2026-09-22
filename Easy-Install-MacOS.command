#!/bin/bash
# SandLoader easy install for macOS. Double-click this file.
# Terminal.app opens it and runs the same steps as the Linux installer.
cd "$(dirname "$0")"
printf '\033[38;2;255;231;0m\n  SANDLOADER\033[0m\n'
printf '  macOS\n\n'
bash "./Easy-Install-Linux.sh" "$@"
echo
printf '  Press any key to close this window.'
read -r -n 1 -s _key
printf '\n'
