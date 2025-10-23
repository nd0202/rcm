#!/usr/bin/env bash
# Usage: ./transcode.sh s3-key id
# Example: ./transcode.sh raw-videos/abcd1234-video.mp4 abcd1234

set -euo pipefail  # safer bash options

# ===== CONFIG =====
S3_BUCKET=${S3_BUCKET:-nitin-pbacket}   # use your actual bucket
AWS_REGION=${AWS_REGION:-ap-south-1}    # default region
KEY=$1    # input S3 key (e.g. raw-videos/<uuid>-filename.mp4)
ID=$2     # unique id for output prefix

TMP_IN="/tmp/input-$ID.mp4"
OUT_DIR="/tmp/out-$ID"

mkdir -p "$OUT_DIR"

# ===== DOWNLOAD FROM S3 =====
echo "📥 Downloading s3://$S3_BUCKET/$KEY ..."
aws s3 cp "s3://$S3_BUCKET/$KEY" "$TMP_IN"

# ===== TRANSCODE TO HLS =====
echo "🎞️ Transcoding to HLS format..."
ffmpeg -y -i "$TMP_IN" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  -hls_time 6 -hls_playlist_type vod \
  -hls_segment_filename "$OUT_DIR/segment_%03d.ts" \
  "$OUT_DIR/master.m3u8"

# ===== UPLOAD TO S3 =====
echo "🚀 Uploading HLS output to S3..."
aws s3 cp "$OUT_DIR" "s3://$S3_BUCKET/hls/$ID" --recursive --acl public-read

# ===== CLEANUP =====
rm -rf "$TMP_IN" "$OUT_DIR"

# ===== OUTPUT URL =====
HLS_URL="https://$S3_BUCKET.s3.${AWS_REGION}.amazonaws.com/hls/$ID/master.m3u8"

echo "✅ HLS transcoding complete!"
echo "🎥 Stream URL: $HLS_URL"
