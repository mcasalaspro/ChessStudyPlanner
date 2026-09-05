# Chess Study Planner

Cronômetro de estudo de xadrez com calendário arrastável, missões (metas de horas por tema com prazo), relatórios e página de relatório para PDF. Site estático (HTML + CSS + JS puro) hospedado no **GitHub Pages**, com login e banco de dados online no **Supabase**. Cada usuário só vê os próprios dados.

```
index.html          página única (app + relatório, roteado por #/relatorio)
config.js           ← ÚNICO arquivo que você precisa editar (URL e chave do Supabase)
css/app.css         visual
js/*.js             código (carregado em ordem)
assets/             logo e imagem de fundo
supabase/schema.sql script do banco de dados (rodar uma vez no Supabase)
publicar.bat        envia/atualiza o projeto no GitHub com dois cliques
```

---

## 1. Criar o banco de dados (Supabase) — uma vez só

1. Crie uma conta gratuita em <https://supabase.com> e clique em **New project**. Escolha um nome, uma senha forte para o banco e a região *South America (São Paulo)*. Aguarde ~2 minutos.
2. No menu lateral, abra **SQL Editor** → **New query**, cole **todo** o conteúdo de `supabase/schema.sql` e clique em **Run**. Isso cria a tabela `study_records` e as regras de segurança (RLS).
3. Ainda no menu lateral: **Authentication → Sign In / Providers**:
   - em **Email**, deixe *Enable Email provider* ligado e **desligue** *Confirm email* (assim os usuários que você criar entram na hora, sem e-mail de confirmação);
   - em **Authentication → Sign In / Up** (em versões antigas do painel: *Settings*), **desligue** *Allow new users to sign up*. Assim só você cria contas.
4. Pegue as duas informações do projeto em **Project Settings → API**:
   - **Project URL** (ex.: `https://abcdefghijklmnop.supabase.co`)
   - **anon public** key (um texto longo começando com `eyJ...`)
5. Abra o arquivo `config.js` e cole as duas informações:

```js
window.CSP_CONFIG = {
  supabaseUrl: 'https://abcdefghijklmnop.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....',
  homeUrl: '',   // opcional: link do botão "Voltar" (ex.: seu site principal)
};
```

> **A chave `anon` pode ficar pública?** Sim — é feita para isso. Quem a tiver só consegue *tentar* fazer login. Sem estar logado não vê nada, e logado só vê as próprias linhas, porque a tabela tem Row Level Security (`auth.uid() = user_id`). Quem baixar o repositório do GitHub leva apenas o código e essa chave pública; nenhum dado de estudo fica no repositório.

## 2. Criar os usuários (você mesmo, manualmente)

No Supabase: **Authentication → Users → Add user → Create new user**.
Preencha e-mail e senha, marque **Auto Confirm User** e salve. Repita para cada pessoa.
Envie a ela o endereço do site e a senha. Para trocar uma senha ou remover alguém, use a mesma tela (menu `⋯` ao lado do usuário).

## 3. Publicar no GitHub Pages

1. Instale o Git para Windows (<https://git-scm.com/download/win>) se ainda não tiver.
2. Crie um repositório **vazio** em <https://github.com/new>. No plano gratuito do GitHub, o Pages só funciona em repositório **público** — sem problema, ele contém apenas o código e a chave pública; nenhum dado de estudo passa por ali.
3. Dê dois cliques em **`publicar.bat`**. Na primeira vez ele pede seu nome, e-mail e o endereço do repositório (ex.: `https://github.com/seu-usuario/chess-study-planner.git`) e envia tudo. Se o Git pedir senha, use um *Personal Access Token* (GitHub → Settings → Developer settings → Tokens).
4. No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save**. Em 1–2 minutos o site estará em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
5. **Atualizações:** alterou algo? Dois cliques em `publicar.bat` de novo. Só isso.

Testar antes de publicar: abra `index.html` direto no navegador. Com `config.js` preenchido ele já pede login; com `config.js` vazio funciona em **modo local** (dados só naquele navegador, sem login) — bom para experimentar.

---

## 4. Como usar

**Cronômetro** — escolha o tema nos chips e clique **Iniciar**. *Pausar/Retomar*, **+10 min** (esqueceu de iniciar? recua o início 10 minutos), **Encerrar** (abre o painel lateral para revisar e comentar o bloco). *Avisar pausa a cada N min* mostra um lembrete de pausa a cada N minutos de estudo líquido. **Modo foco** ocupa a tela inteira com o relógio. Atalhos: `Espaço` pausa/retoma · `F` modo foco · `N` nota rápida · `Ctrl+Z` desfaz.

**Lançar horas manualmente** — tema, data, hora de início, duração e comentário → *Registrar*.

**Missões** — meta de horas de um tema até um prazo (50 em 50 h). Mostra progresso, dias restantes e a média diária necessária. Clique numa missão para editar/concluir/apagar.

**Calendário de estudo** — linhas = dias, colunas = horas (Semana / Mês / Trimestre, com ‹ › para navegar):
- **clique** num bloco → abre o **painel lateral** com tema, data, início, fim, duração, pausas e comentário — cada alteração é aplicada na hora (e pode ser desfeita com `Ctrl+Z`);
- **arraste** o bloco para mudar o horário (horizontal) ou o dia (vertical); **puxe as bordas** para esticar/encurtar; **Alt + arrastar** duplica;
- **clique num espaço vazio** cria um bloco (duração padrão configurável) ou **arraste no vazio** para desenhar a duração;
- teclado: `←→` move 15 min, `Shift+←→` altera o fim, `↑↓` muda o dia, `Enter` abre, `Del` apaga;
- blocos com **comentário** têm o ícone 💬; blocos **tracejados** são planejados (futuro) e só contam quando acontecem;
- clique no **nome do dia** para ver a lista de blocos daquele dia.
- Blocos nunca se sobrepõem: ao arrastar para cima de outro, ele encosta na borda (encaixe magnético).

**Relatórios** — Semana (7 dias) / Mês (30 dias) / Total: tempo, sequência de dias e tema principal, com barras por tema. **📄 Relatório de estudos** abre a página completa (visão geral mensal por tema, missões e prazos, calendário de 30/60/90 dias, comentários) e **Salvar PDF** usa a impressão do navegador (*Salvar como PDF*).

**⚙ Configurações** (ícone no topo) — seu nome (aparece no relatório), temas (adicionar, renomear, cor, remover), tempo para encerrar pausa esquecida, mínimo diário da sequência, som, notificações, animação do modo foco, exportar CSV / backup JSON, importar backup, dados de exemplo, apagar tudo e **Sair da conta**.

## 5. Como os dados são guardados

- Tudo é salvo primeiro no navegador (cache local) e enviado ao Supabase em seguida — um indicador no topo mostra *Sincronizado / Salvando… / Offline*. Sem internet você continua trabalhando; os envios pendentes saem quando a conexão volta.
- Ao abrir o app (e a cada 5 min) ele baixa os dados da conta, então dá para usar no computador e no celular com a mesma conta. Em caso de edição do mesmo bloco em dois aparelhos, vale a alteração mais recente.
- Blocos apagados ficam marcados como apagados (não somem do banco) para a sincronização funcionar; *Desfazer* logo após apagar restaura.
- Recomendação: de vez em quando faça **⚙ → Backup JSON**. O plano gratuito do Supabase pausa projetos sem uso por 7 dias — basta reativá-lo no painel; nada é perdido.

## 6. Perguntas frequentes

**Esqueci a senha de um usuário.** Supabase → Authentication → Users → `⋯` → *Reset password* / definir nova senha.

**Quero que o botão "Voltar" leve para o meu site.** Preencha `homeUrl` em `config.js`.

**Quero mudar os temas padrão para novos usuários.** Edite `DEFAULT_THEMES` em `js/01-store.js` (cada usuário também pode personalizar os seus em ⚙).

**Posso hospedar em outro lugar?** Sim — é um site estático; qualquer hospedagem (Netlify, Vercel, servidor próprio) serve.
