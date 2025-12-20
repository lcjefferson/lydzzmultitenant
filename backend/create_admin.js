
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createData() {
  console.log('Iniciando criacao de usuario admin...');
  const hash = await bcrypt.hash('senha123', 10);
  
  try {
    // 1. Tenta achar QUALQUER organizacao existente
    let org = await prisma.organization.findFirst();

    // 2. Se nao existir, cria uma nova
    if (!org) {
      console.log('Nenhuma organizacao encontrada. Criando nova...');
      org = await prisma.organization.create({
        data: {
          name: 'Minha Empresa',
          slug: 'minha-empresa-' + Date.now(), // Slug unico garantido
          plan: 'free'
        }
      });
    }
    console.log('Usando organizacao:', org.id, org.name);

    // 3. Criar/Atualizar Usuário vinculado a essa organizacao
    const user = await prisma.user.upsert({
      where: { email: 'admin@admin.com' },
      update: { 
        password: hash,
        organizationId: org.id 
      },
      create: {
        email: 'admin@admin.com',
        name: 'Admin',
        password: hash,
        role: 'admin',
        organizationId: org.id
      }
    });
    console.log('------------------------------------------------');
    console.log('SUCESSO TOTAL!');
    console.log('Usuario: admin@admin.com');
    console.log('Senha:   senha123');
    console.log('------------------------------------------------');
  } catch (e) {
    console.error('ERRO FATAL:', e);
  } finally {
    await prisma.$disconnect();
  }
}

createData();
