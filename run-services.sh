#!/bin/bash

echo "🚀 Iniciando Chatbot LM Studio (Frontend + Backend)"
echo ""

# Check if LM Studio is running
if ! curl -s http://localhost:1234/v1/models > /dev/null 2>&1; then
    echo "⚠️  LM Studio API no está disponible en localhost:1234"
    echo "💡 Asegúrate de que LM Studio esté ejecutándose y tenga cargado un modelo"
    echo ""
fi

echo "🔧 Iniciando backend Express (server.js)..."
node server.js >/tmp/chatbot-backend.log 2>&1 &
BACKEND_PID=$!
sleep 2

if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ Backend Express arrancado (PID: $BACKEND_PID)"
else
    echo "❌ Backend Express falló al arrancar"
    exit 1
fi

echo ""
echo "🎨 Iniciando frontend Vite..."
echo "🌐 Accesible desde tu móvil en:"
echo "   LAN: http://192.168.1.181:3001/"
echo "   Tailscale: http://100.119.129.71:3001/"
echo ""

npm run dev -- --host 0.0.0.0 --port 3001 &
VITE_PID=$!

echo ""
echo "✅ Todo arrancado:"
echo "   - Backend: PID $BACKEND_PID (puerto 3000 por defecto)"
echo "   - Frontend: PID $VITE_PID (puerto 3001)"
echo ""

# Keep the script running until both processes exit
while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Backend Express died (PID $BACKEND_PID)"
        kill $VITE_PID 2>/dev/null
        exit 1
    fi
    if ! kill -0 $VITE_PID 2>/dev/null; then
        echo "❌ Frontend Vite died (PID $VITE_PID)"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
    sleep 1
done
