#!/bin/bash

API_URL="https://6ag0l59zmc.execute-api.us-east-1.amazonaws.com/dev/metrics"

echo "🚀 Creating test alerts..."
echo ""

# Test 1: LOW_INVENTORY alert (chargedBatteries < 8)
echo "1. Creating LOW_INVENTORY alert (STATION_001)..."
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "STATION_001",
    "chargedBatteries": 3,
    "unchargedBatteries": 8,
    "queue": 5,
    "swapRate": 30
  }'
echo -e "\n"

sleep 2

# Test 2: CONGESTION alert (queue > 12 for 2 cycles)
echo "2. Creating CONGESTION alert - Cycle 1 (STATION_002)..."
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "STATION_002",
    "queue": 15,
    "chargedBatteries": 12,
    "swapRate": 50
  }'
echo -e "\n"

sleep 2

echo "3. Creating CONGESTION alert - Cycle 2 (STATION_002)..."
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "STATION_002",
    "queue": 18,
    "chargedBatteries": 12,
    "swapRate": 55
  }'
echo -e "\n"

sleep 2

# Test 3: CRITICAL alert (both congestion + low inventory)
echo "4. Creating CRITICAL alert - Cycle 1 (STATION_003)..."
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "STATION_003",
    "queue": 15,
    "chargedBatteries": 4,
    "swapRate": 60
  }'
echo -e "\n"

sleep 2

echo "5. Creating CRITICAL alert - Cycle 2 (STATION_003)..."
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "STATION_003",
    "queue": 18,
    "chargedBatteries": 3,
    "swapRate": 65
  }'
echo -e "\n"

sleep 2

# Test 4: HARDWARE alert (faults >= 3 in 30 min)
echo "6. Creating HARDWARE alert (STATION_004)..."
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "STATION_004",
    "chargedBatteries": 10,
    "queue": 3,
    "swapRate": 20,
    "faultPatterns": ["FAULT_A", "FAULT_B", "FAULT_C"]
  }'
echo -e "\n"

sleep 2

# Test 5: DEMAND spike alert
echo "7. Creating baseline metrics for DEMAND alert (STATION_005)..."
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "STATION_005",
    "chargedBatteries": 15,
    "queue": 5,
    "swapRate": 30
  }'
echo -e "\n"

sleep 2

echo "8. Creating DEMAND spike (STATION_005)..."
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "STATION_005",
    "chargedBatteries": 15,
    "queue": 8,
    "swapRate": 75,
    "demandSurge": true
  }'
echo -e "\n"

sleep 2

# Test 6: OPTIMIZE alert (underutilized)
echo "9. Creating OPTIMIZE alert (STATION_006)..."
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "STATION_006",
    "chargedBatteries": 20,
    "queue": 1,
    "swapRate": 15,
    "maxCapacity": 100
  }'
echo -e "\n"

sleep 2

echo ""
echo "✅ Test data created!"
echo ""
echo "📊 Fetching alerts..."
curl -s "https://6ag0l59zmc.execute-api.us-east-1.amazonaws.com/dev/alerts?status=PENDING" | jq '.alerts[] | {alertId, stationId, alertType, severity, status, title}'

echo ""
echo "Done! Check your dashboard at http://localhost:3000"
