#!/bin/bash

echo "🚀 Iniciando Chatbot LM Studio"
echo ""

# Check if LM Studio is running
if ! curl -s http://localhost:1234/v1/models > /dev/null 2>&1; then
    echo "⚠️  LM Studio API no está disponible en localhost:1234"
    echo "💡 Asegúrate de que LM Studio esté ejecutándose y tenga cargado un modelo"
    echo ""
fi

echo "🔧 Iniciando servidor Vite..."
echo "🌐 Accesible desde tu móvil en: http://192.168.1.181:3000"
echo ""

npm run dev
