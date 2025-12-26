
import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function main() {
  console.log('=== CRIAR NOVO ADMINISTRADOR ===');

  try {
    // 1. Organization
    let orgId: string | undefined;
    
    console.log('\n--- Configuração da Organização ---');
    const orgAction = await question('Deseja usar uma organização existente (E) ou criar uma nova (N)? [E/N]: ');
    
    if (orgAction.toLowerCase() === 'n') {
      const orgName = await question('Nome da nova organização: ');
      const plan = await question('Plano (starter/professional/enterprise) [starter]: ') || 'starter';
      
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      
      const newOrg = await prisma.organization.create({
        data: {
          name: orgName,
          slug: slug, // Simple slug generation
          plan: plan,
        },
      });
      orgId = newOrg.id;
      console.log(`Organização criada: ${newOrg.name} (${newOrg.id})`);
    } else {
      // List existing orgs
      const orgs = await prisma.organization.findMany({ take: 5 });
      if (orgs.length === 0) {
        console.log('Nenhuma organização encontrada. Você deve criar uma nova.');
        const orgName = await question('Nome da nova organização: ');
        const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        const newOrg = await prisma.organization.create({
          data: { name: orgName, slug },
        });
        orgId = newOrg.id;
      } else {
        console.log('Organizações recentes:');
        orgs.forEach((o, i) => console.log(`${i + 1}. ${o.name} (${o.slug})`));
        
        const orgIdentifier = await question('Digite o Slug ou ID da organização: ');
        const org = await prisma.organization.findFirst({
          where: {
            OR: [
              { id: orgIdentifier },
              { slug: orgIdentifier }
            ]
          }
        });
        
        if (!org) {
          throw new Error('Organização não encontrada.');
        }
        orgId = org.id;
        console.log(`Organização selecionada: ${org.name}`);
      }
    }

    // 2. User
    console.log('\n--- Dados do Administrador ---');
    const name = await question('Nome do usuário: ');
    const email = await question('Email: ');
    const password = await question('Senha: ');
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error(`Usuário com email ${email} já existe.`);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: passwordHash,
        role: 'admin',
        organizationId: orgId!,
      },
    });

    console.log('\n=== SUCESSO ===');
    console.log(`Usuário Admin criado com sucesso!`);
    console.log(`Email: ${user.email}`);
    console.log(`Organização ID: ${user.organizationId}`);

  } catch (error) {
    console.error('\nErro ao criar administrador:', error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main();
