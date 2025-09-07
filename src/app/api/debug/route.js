import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET() {
  const caminhos = {
    process_cwd: process.cwd(),
    caminho_tentado: path.join(process.cwd(), '..', 'downloads', 'risoflora-finance'),
    caminho_direto: path.join(process.cwd(), 'downloads', 'risoflora-finance'),
    caminho_absoluto: path.resolve('downloads', 'risoflora-finance')
  };

  // Verificar quais caminhos existem
  const existencias = {
    process_cwd: fs.existsSync(process.cwd()),
    tentado: fs.existsSync(caminhos.caminho_tentado),
    direto: fs.existsSync(caminhos.caminho_direto),
    absoluto: fs.existsSync(caminhos.caminho_absoluto)
  };

  return NextResponse.json({ caminhos, existencias });
}