# Mascotfy Studio – Gestão de Vídeos

Aplicativo web (React + Firebase) para organizar a produção de vídeos de
mascotes 3D: vendedor cadastra o pedido, o criador produz e sobe o vídeo, o
vendedor entrega ao cliente. Login restrito (sem cadastro público), painel do
gestor, prazos em dias úteis, conversão automática de imagens, modo claro/escuro
e identidade visual roxa (#7C35E9).

## O que já está pronto

- Login por e-mail/senha (Firebase Authentication), sem cadastro público.
- Conta mestre (`mascotfystudio@gmail.com`) com auto-provisionamento no primeiro login.
- Aba **Usuários** (só para a conta mestre): criar, editar, ativar/desativar, redefinir senha.
- Três áreas por nível: **Vendedor**, **Criador de Vídeos**, **Gestor Geral**.
- Pedidos com status Pendente → Em produção → Pronto → Entregue, com histórico de quem mudou e quando.
- Prazo de produção de 2 dias úteis, considerando feriados nacionais.
- Upload de imagens com conversão automática (HEIC, JFIF, BMP, GIF → JPEG/PNG), redimensionamento e miniaturas reordenáveis.
- Upload de vídeos com barra de progresso, arrastar-e-soltar e re-seleção de arquivo.
- Estrutura de pastas **"Dados dos Leads"** no Firebase Storage, com numeração sequencial de pedidos via transação do Firestore.
- Painel do Gestor: cards clicáveis, tabela com busca/filtros, edição/exclusão (individual e em massa), "Limpar todos os dados", calendário em popover (fechado por padrão) e gráfico de vendas por dia.
- Abas "Dados dos Leads", "Todos os Vídeos" e "Finalizados".
- Modo claro/escuro/automático, com visual roxo responsivo (mobile-first).
- Regras de segurança do Firestore e do Storage, já escritas para publicar.

## O que ficou de fora desta primeira versão (e por quê)

- **Sincronização automática com o Google Drive.** O fluxo descrito exige um
  pequeno servidor à parte (para guardar o token OAuth fora do navegador) e uma
  conta/projeto Google Cloud própria. Eu não tenho como hospedar esse servidor
  por aqui. Por enquanto, todos os arquivos vão para o **Firebase Storage**, já
  na estrutura "Dados dos Leads" — funcionalmente equivalente para o dia a dia.
  Se depois vocês quiserem a integração com o Drive, dá para construir um
  servidor Node pequeno (Cloud Functions, Render ou Railway) que implementa
  exatamente o fluxo descrito no documento original; me avisem quando for a hora.
- **Criar pedido pelo Painel do Gestor.** Hoje só o Vendedor tem o formulário de
  "Novo pedido" (o Gestor pode editar/excluir/mudar status de qualquer pedido,
  só não tem o formulário de criação — é fácil de adicionar depois).
- **Restrição fina por campo no Storage.** As regras do Storage liberam leitura/
  gravação para qualquer usuário ativo (não distinguem vendedor x criador por
  pedido no nível do arquivo), porque o nome da pasta é pensado para ser
  legível por humanos (não um ID). Quem decide o que cada pessoa vê é o
  Firestore (e a própria tela do app); ocultar valores/telefone do Criador é
  feito na interface. Se um dia isso for crítico, dá para reforçar com Cloud
  Functions.

## 1. Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou mais recente.
- Uma conta Google (pode ser a mesma do Gmail de vocês).
- ~20 minutos para o primeiro deploy.

## 2. Criar o projeto Firebase

1. Acesse https://console.firebase.google.com/ e clique em **Adicionar projeto**.
   Dê um nome (ex.: `mascotfy-studio`) e conclua a criação.
2. No menu lateral, abra **Build > Authentication** → aba **Sign-in method** →
   ative o provedor **E-mail/senha**.
3. Abra **Build > Firestore Database** → **Criar banco de dados** → escolha o
   modo **produção** e a localização mais próxima de vocês (ex. `southamerica-east1`).
   **Importante:** deixe o ID do banco como **`(default)`** (não crie um banco
   com nome personalizado) — as regras de Storage deste projeto pressupõem o
   banco padrão.
4. Abra **Build > Storage** → **Começar** → siga o assistente (pode pedir para
   ativar o plano **Blaze**, que é "pague conforme o uso"; o uso de 2 pessoas
   fica dentro ou muito perto da faixa gratuita).
5. Em **Configurações do projeto** (ícone de engrenagem) → aba **Geral** →
   role até "Seus apps" → clique no ícone **`</>`** (Web) → registre um app
   (ex. `mascotfy-web`) → copie o objeto `firebaseConfig` que aparece.

### Criar a conta mestre

Como não existe tela de "criar conta" no app, a primeira conta precisa ser
criada direto no Firebase:

1. Em **Authentication > Users**, clique em **Add user**.
2. E-mail: `mascotfystudio@gmail.com`. Defina a senha que vocês quiserem.
3. Pronto — na primeira vez que essa conta logar no app, o sistema cria
   automaticamente o cadastro dela no Firestore com nível "Gestor Geral" (mestre).

## 3. Configurar o projeto localmente

```bash
# 1. Extraia o .zip e entre na pasta
cd mascotfy-studio

# 2. Instale as dependências
npm install

# 3. Copie o arquivo de variáveis de ambiente e preencha com o firebaseConfig do passo 2
cp .env.example .env
```

Abra `.env` e preencha com os valores copiados do Console do Firebase:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Teste localmente:

```bash
npm run dev
```

Abra o endereço mostrado no terminal (geralmente `http://localhost:5173`) e
faça login com a conta mestre.

## 4. Publicar as regras de segurança (Firestore e Storage)

```bash
npm install -g firebase-tools   # se ainda não tiver
firebase login
```

Edite o arquivo `.firebaserc` e troque `SEU-PROJECT-ID-AQUI` pelo ID do seu
projeto (o mesmo da URL do Console do Firebase), ou rode:

```bash
firebase use --add
```

Depois publique as regras e os índices:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

> Se aparecer um erro pedindo para criar um índice do Firestore na primeira
> vez que a área do Vendedor carregar, é normal — o comando acima já inclui o
> índice necessário (`firestore.indexes.json`), mas se mesmo assim aparecer um
> link de erro no console do navegador, clique nele para criar o índice em um
> clique.

## 5. Hospedar o app (Firebase Hosting, gratuito)

```bash
npm run build
firebase deploy --only hosting
```

Ao final, o terminal mostra o link público (algo como
`https://seu-projeto.web.app`) — esse é o endereço que você e seu irmão vão
usar no dia a dia, inclusive pelo celular.

Sempre que quiserem atualizar o app no futuro (nova versão, ajustes), rodem de
novo `npm run build && firebase deploy --only hosting`.

## 6. Criar o segundo usuário (seu irmão)

1. Entre no app com a conta mestre.
2. Vá em **Usuários** (só aparece para a conta mestre) → **Novo usuário**.
3. Preencha nome, e-mail, uma senha inicial e o nível (Vendedor, Criador de
   Vídeos ou Gestor Geral).
4. Passe a senha inicial para a pessoa por um canal seguro — ela pode trocá-la
   depois pelo link "Esqueci minha senha" na tela de login.

## 7. Trocar o logo

O app usa um logo roxo provisório (um "rostinho" simples). Para usar o logo
oficial da Mascotfy:

1. Coloque o arquivo em `public/logo.svg` (ou `.png`).
2. Em `src/components/MascotfyLogo.tsx`, troque o SVG interno por
   `<img src="/logo.svg" width={size} height={size} />`.
3. Troque também `public/favicon.svg` pelo favicon oficial (ou aponte o
   `<link rel="icon">` em `index.html` para o novo arquivo).

## 8. Custos esperados

Para o uso de uma pequena equipe (2 pessoas, alguns pedidos por dia), o app
deve ficar dentro — ou muito perto — da faixa gratuita do Firebase
(Spark/Blaze): Authentication, Firestore, Storage e Hosting têm cotas
gratuitas generosas para esse volume. O maior consumo tende a ser o
armazenamento/egresso de vídeo no Storage; vale acompanhar o painel de uso do
Firebase nos primeiros meses.

## 9. Problemas comuns

- **"Missing or insufficient permissions"**: normalmente é regra ainda não
  publicada (rode o passo 4 de novo) ou o usuário ainda não tem cadastro ativo
  em `users` (confira na aba Usuários).
- **Upload trava ou nunca termina**: confirme se o Storage foi mesmo ativado
  no Console (passo 2.4) — um bucket ainda não habilitado é a causa mais comum.
- **Erro ao logar com e-mail/senha**: confirme se o provedor "E-mail/senha" foi
  habilitado em Authentication (passo 2.2).
- **Link de índice do Firestore aparece no console do navegador**: clique nele
  para criar o índice automaticamente (ou rode o deploy do passo 4 de novo).

## Estrutura do projeto

```
src/
  lib/            Firebase, utilitários, regras de dias úteis, upload, pedidos, usuários
  contexts/       Autenticação e tema (claro/escuro)
  components/     Peças reutilizáveis (modais, uploaders, calendário, etc.)
  views/
    LoginView.tsx
    seller/       Área do Vendedor
    creator/      Área do Criador de Vídeos
    manager/      Painel do Gestor + Usuários
firestore.rules   Regras de segurança do Firestore
storage.rules     Regras de segurança do Storage
firebase.json     Configuração de deploy (Hosting, Firestore, Storage)
```
