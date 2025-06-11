if [! npm list fastify &> /dev/null ]; then
    npm i fastify
fi 
    echo "Exist already .";

if [! npm list tailwindcss &> /dev/null || npm list @tailwindcss/cli &> /dev/null ]; then
    npm install tailwindcss @tailwindcss/cli
fi
    echo "Exist already .";
