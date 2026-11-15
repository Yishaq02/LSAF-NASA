#!/bin/bash
cd "$(dirname "$0")"
echo "Iniciando SPHEREx Backend en el puerto 8000..."
python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
