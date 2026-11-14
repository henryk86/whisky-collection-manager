#!/bin/sh
# Archive immutable GitHub release payloads next to existing USB/NAS backup data.
# Usage: sh deploy/save-offline-release.sh /path/to/downloaded-release /mounted/backup-root
# The destination must carry the same marker as the WCM backup target.
set -eu
if [ "$#" -ne 2 ]; then
    echo 'Usage: sh deploy/save-offline-release.sh SOURCE_DIR BACKUP_TARGET_ROOT' >&2
    exit 2
fi
source_dir=$1
backup_root=$2
[ -d "$source_dir" ] || { echo "Source directory not found: $source_dir" >&2; exit 1; }
[ -d "$backup_root" ] || { echo "Backup target not mounted: $backup_root" >&2; exit 1; }
[ -f "$backup_root/.whisky-backup-target" ] || {
    echo 'Missing .whisky-backup-target marker. Check the USB/NAS mount before copying.' >&2
    exit 1
}
command -v sha256sum >/dev/null || { echo 'sha256sum is required.' >&2; exit 1; }
found=0
for checksum in "$source_dir"/*.sha256; do
    [ -f "$checksum" ] || continue
    checksum_name=${checksum##*/}
    archive_name=${checksum_name%.sha256}
    case "$archive_name" in
        whisky-collection-manager-v*-offline.zip|whisky-collection-manager-v*-linux-arm64.tar.gz|whisky-collection-manager-v*-linux-amd64.tar.gz) ;;
        *) continue ;;
    esac
    # Reject filenames and checksum entries that could escape either directory.
    case "$archive_name" in *[!a-zA-Z0-9._-]*|*..*) echo 'Unsafe release filename.' >&2; exit 1;; esac
    [ -f "$source_dir/$archive_name" ] || { echo "Missing archive: $archive_name" >&2; exit 1; }
    expected=$(sed -n '1p' "$checksum")
    hash=${expected%% *}
    target=${expected#*  }
    [ "$target" = "$archive_name" ] || { echo "Checksum filename mismatch: $checksum_name" >&2; exit 1; }
    case "$hash" in *[!a-f0-9]*|'') echo 'Invalid SHA-256 value.' >&2; exit 1;; esac
    [ "${#hash}" -eq 64 ] || { echo 'Invalid checksum length.' >&2; exit 1; }
    (cd "$source_dir" && printf '%s  %s\n' "$hash" "$archive_name" | sha256sum -c - >/dev/null) || {
        echo "Checksum failed before copying: $archive_name" >&2; exit 1
    }
    release=${archive_name#whisky-collection-manager-}
    release=${release%%-*}
    dest="$backup_root/whisky-releases/$release"
    mkdir -p "$dest"
    # Refuse to overwrite existing archives, even in a repeat run.
    if [ -e "$dest/$archive_name" ]; then
        (cd "$dest" && printf '%s  %s\n' "$hash" "$archive_name" | sha256sum -c - >/dev/null) || {
            echo "Existing archive differs from source: $archive_name" >&2; exit 1
        }
    else
        tmp="$dest/$archive_name.part.$$"
        trap 'rm -f "$tmp"' EXIT HUP INT TERM
        cp "$source_dir/$archive_name" "$tmp"
        actual=$(sha256sum "$tmp")
        [ "${actual%% *}" = "$hash" ] || { echo "Copy checksum failed: $archive_name" >&2; exit 1; }
        mv "$tmp" "$dest/$archive_name"
        trap - EXIT HUP INT TERM
    fi
    cp "$checksum" "$dest/$checksum_name"
    (cd "$dest" && sha256sum -c "$checksum_name" >/dev/null)
    echo "Archived and verified: $dest/$archive_name"
    found=$((found + 1))
done
[ "$found" -gt 0 ] || { echo 'No matching offline release assets and .sha256 files found.' >&2; exit 1; }
