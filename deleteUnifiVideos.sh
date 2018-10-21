curl -X POST  -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/javascript, */*; q=0.01' \
    -d @$1 -v \
    --insecure https://video:7443/api/2.0/recording/deleteRecordingIds?apiKey=$UNIFI_VIDEO_ACCESS_TOKEN