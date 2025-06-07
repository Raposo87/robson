# Use uma imagem oficial do Node.js
FROM node:18-alpine

# Defina o diretório de trabalho dentro do container
WORKDIR /app

# Copie o package.json para o diretório backend
COPY package.json ./backend/

# Mude para o diretório backend e instale as dependências
WORKDIR /app/backend
RUN npm install

# Volte para o diretório raiz e copie todos os arquivos
WORKDIR /app
COPY . .

# Exponha a porta que o servidor vai usar
EXPOSE 3001

# Comando para iniciar o servidor
CMD ["node", "backend/server.js"]