# 🩺 Active Age — Consultório Virtual & Telemedicina para a Terceira Idade
 
<p align="center">
<img src="public/logo.png" alt="Active Age Logo" width="180" />
</p>
 
<p align="center">
<strong>Plataforma moderna e acessível de telemedicina focada na terceira idade e gestão completa de consultório virtual para médicos especialistas.</strong>
</p>
 
<p align="center">
<a href="https://active-age-frontend.vercel.app" target="_blank">
<img src="https://img.shields.io/badge/Deploy-Vercel-black?style=for-the-badge&logo=vercel" alt="Vercel Deploy" />
</a>
<img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react" alt="React 19" />
<img src="https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
<img src="https://img.shields.io/badge/Vite-8-purple?style=for-the-badge&logo=vite" alt="Vite" />
<img src="https://img.shields.io/badge/Bootstrap-5.3-purple?style=for-the-badge&logo=bootstrap" alt="Bootstrap 5" />
<img src="https://img.shields.io/badge/Mercado_Pago-00B1EA?style=for-the-badge&logo=mercado-pago&logoColor=white%22 alt="Mercado Pago" />
<img src="https://img.shields.io/badge/WebRTC-ZegoCloud-333333?style=for-the-badge&logo=webrtc" alt="ZegoCloud WebRTC" />
</p>
 
---
 
## 🌐 Demonstração Online
 
Acesse o projeto em produção (Front-end):  

👉 **[https://active-age-frontend.vercel.app](https://active-age-frontend.vercel.app)**
 
---
 
## 💡 Sobre o Projeto
 
O **Active Age** é uma solução de saúde digital desenvolvida com foco na acessibilidade para o público idoso e na praticidade de atendimento para profissionais de saúde. A plataforma une:

1. **Atendimento Humanizado para o Idoso:** Telas intuitivas, alto contraste, botões grandes e teleconsulta acessível com um clique.

2. **Consultório Virtual Completo para Médicos:** Planos de assinatura gerenciáveis, prontuário eletrônico, emissão de documentos médicos digitais em PDF (receitas, laudos e atestados) e agenda personalizada.

3. **Auditoria e Segurança Administrativa:** Central de validação de CRM e conformidade com as rigorosas normas do CFM e LGPD.
 
---
 
## ✨ Principais Funcionalidades
 
### 🩺 Para Médicos & Especialistas

- **Planos de Consultório:** Assinatura mensal e anual integrada via Checkout Pro do Mercado Pago, processada por um microserviço financeiro isolado.

- **Extrato Financeiro & Faturas:** Acompanhamento de faturas, recibos eletrônicos de quitação com impressão nativa em PDF A4.

- **Agenda Inteligente:** Criação de horários livres de atendimento com prevenção automática de conflitos (intervalos de 40 min).

- **Prontuário & Documentos:** Emissão de receitas médicas digitais, laudos e atestados timbrados (prontos para impressão).

- **Sala de Teleconsulta HD:** Sala de videoconferência ao vivo com áudio, vídeo e chat via WebRTC (**ZEGOCLOUD**).

- **Dashboard em Tempo Real:** Interface inteligente com *Long Polling* para atualização dinâmica do status da assinatura e aprovação de CRM sem necessidade de recarregar a página.
 
### 👴 Para Pacientes

- **Busca de Médicos:** Filtro inteligente por especialidade e disponibilidade de agenda.

- **Agendamento Descomplicado:** Escolha de data e horário com interface simplificada, evitando sobreposição de consultas.

- **Sala de Espera Virtual:** Acesso direto e descomplicado à sala de vídeo na hora agendada.

- **Perfil Acessível:** Visualização do histórico de consultas e facilidade no manuseio.
 
### 🛡️ Painel Administrativo

- **Central de Validação de CRM:** Auditoria e aprovação cadastral de novos médicos com checagem especializada, liberando imediatamente o acesso ao sistema.
 
---
 
## 🛠️ Tecnologias Utilizadas
 
- **Frontend Core:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)

- **Roteamento:** [React Router DOM v7](https://reactrouter.com/)

- **Estilização & UI:** [Bootstrap 5](https://getbootstrap.com/), [Bootstrap Icons](https://icons.getbootstrap.com/), CSS Modules com Impressão Limpa (`@media print`)

- **Comunicação em Tempo Real:** [@zegocloud/zego-uikit-prebuilt](https://www.zegocloud.com/) *(Infraestrutura de Videoconferência)*

- **Pagamentos & Checkout:** API do [Mercado Pago](https://www.mercadopago.com.br/) consumida através do nosso Microserviço de Pagamentos

- **Alertas e Notificações:** [SweetAlert2](https://sweetalert2.github.io/)

- **HTTP Client:** Fetch API Integrada (Comunicação RESTful com Spring Boot)
 
 
## 📁 Estrutura de Pastas
 
```bash

active-age-frontend/

├── public/                  # Arquivos estáticos e logotipos

├── src/

│   ├── components/          # Componentes reutilizáveis

│   │   ├── admin/           # Telas de validação administrativa

│   │   ├── BannerTrialMedico.tsx # Banner inteligente de gestão de plano

│   │   ├── Footer.tsx       # Rodapé global

│   │   ├── Navbar.tsx       # Barra de navegação com perfil

│   │   └── ScrollToTop.tsx  # Scroll suave ao mudar de rota

│   ├── pages/               # Páginas e rotas da aplicação

│   │   ├── Home.tsx

│   │   ├── Login.tsx / Cadastro.tsx

│   │   ├── Dashboard.tsx    # Painel central dinâmico com Polling

│   │   ├── PlanosMedico.tsx # Planos com redirecionamento de Checkout

│   │   ├── ExtratoAssinaturas.tsx # Gestão de faturas e Recibos PDF

│   │   ├── AgendaMedico.tsx / AgendarConsulta.tsx

│   │   ├── SalaTeleconsulta.tsx

│   │   ├── DocumentoMedico.tsx

│   │   └── BuscaMedicos.tsx / PerfilMedicoPublico.tsx

│   ├── App.tsx              # Mapa central de rotas e provedores

│   ├── main.tsx             # Ponto de entrada (Bootstrap point) da aplicação

│   └── index.css            # Estilos globais e CSS de impressão

├── package.json             # Dependências e scripts

└── vite.config.ts           # Configurações do ecossistema Vite

```
 
## 🔒 Segurança e Privacidade
 
- **LGPD:** A plataforma foi projetada seguindo as rigorosas diretrizes da Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).

- **Normas CFM:** Arquitetura adequada aos padrões éticos e técnicos para a prática profissional e legal de Telemedicina no Brasil.
 
---
 
## 📄 Licença
 
Este projeto foi desenvolvido como um sistema acadêmico focado em inovação para saúde digital e arquitetura de microserviços.
