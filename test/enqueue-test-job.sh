#!/bin/bash
# Enqueue a vision pipeline test job.
#
# Usage:
#   ./test/enqueue-test-job.sh red     # auto-match       (score ≥ 0.92)
#   ./test/enqueue-test-job.sh blue    # awaiting_confirm  (0.75–0.91)
#   ./test/enqueue-test-job.sh green   # new problem       (< 0.75)
#
# Prerequisites: docker compose -f docker-compose.test.yml up
set -e

SCENARIO="${1:-red}"
USER_ID="22222222-0000-0000-0000-000000000001"
GYM_ID="11111111-0000-0000-0000-000000000001"
COMPOSE="docker compose -f docker-compose.test.yml"

case "$SCENARIO" in
  red)   COLOUR="#FF0000" ;;
  blue)  COLOUR="#0000FF" ;;
  green) COLOUR="#00FF00" ;;
  *)     echo "Usage: $0 [red|blue|green]"; exit 1 ;;
esac

# Generate a UUID (macOS uuidgen or Python fallback)
UPLOAD_ID=$(uuidgen 2>/dev/null | tr '[:upper:]' '[:lower:]' \
  || python3 -c "import uuid; print(uuid.uuid4())")

echo "==> Scenario: $SCENARIO (colour=$COLOUR)"
echo "==> Upload ID: $UPLOAD_ID"
echo ""

# 1. Insert an upload row directly into Postgres
echo "[1/2] Inserting upload row..."
$COMPOSE exec -T postgres psql -U crux -d crux -q -c "
  INSERT INTO uploads (id, user_id, gym_id, colour, photo_urls, processing_status)
  VALUES (
    '$UPLOAD_ID',
    '$USER_ID',
    '$GYM_ID',
    '$COLOUR',
    ARRAY['test/photo1.jpg', 'test/photo2.jpg'],
    'pending'
  );
"

# 2. Enqueue a BullMQ vision job via the API container's Node runtime
echo "[2/2] Enqueuing BullMQ job..."
$COMPOSE exec -T api node -e "
  const { visionQueue } = require('./dist/src/jobs/queue');
  visionQueue.add('process', {
    uploadId: '$UPLOAD_ID',
    userId:   '$USER_ID',
    gymId:    '$GYM_ID',
    colour:   '$COLOUR',
    photoUrls: ['test/photo1.jpg', 'test/photo2.jpg']
  }).then(() => {
    console.log('Job enqueued');
    return visionQueue.close();
  }).then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
"

echo ""
echo "==> Job enqueued. Watch the vision-worker logs:"
echo "    $COMPOSE logs -f vision-worker"
echo ""
echo "==> Check result:"
echo "    $COMPOSE exec postgres psql -U crux -d crux -c \\"
echo "      \"SELECT processing_status, similarity_score, problem_id FROM uploads WHERE id = '$UPLOAD_ID';\""
