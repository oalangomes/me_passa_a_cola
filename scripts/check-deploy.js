#!/usr/bin/env node
const url = process.argv[2] || 'https://me-passa-a-cola.onrender.com/health';

async function main() {
  try {
    const res = await fetch(url);
    if (res.status === 200) {
      console.log(`OK: ${url} retornou 200`);
      process.exit(0);
    } else {
      console.error(`ERRO: ${url} retornou ${res.status}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Falha ao acessar ${url}:`, err.message);
    process.exit(1);
  }
}

main();
