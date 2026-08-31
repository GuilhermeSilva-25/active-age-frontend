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
 
================================================================================
 
# 🧠 Active Age — Core API & Backend Central
 
<p align="center">
<img src="https://img.shields.io/badge/Deploy-Render-black?style=for-the-badge&logo=render" alt="Render Deploy" />
<img src="https://img.shields.io/badge/Java-21-ED8B00?style=for-the-badge&logo=java&logoColor=white" alt="Java 21" />
<img src="https://img.shields.io/badge/Spring_Boot-3-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white%22 alt="Spring Boot 3" />
<img src="https://img.shields.io/badge/Spring_Security-JWT-6DB33F?style=for-the-badge&logo=spring-security&logoColor=white%22 alt="Spring Security" />
<img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB Atlas" />
</p>
 
---
 
## 🌐 API em Produção
 
Acesse o Endpoint base da nossa API hospedada na nuvem:  

👉 **[https://active-age-backend.onrender.com](https://active-age-backend.onrender.com)**
 
---
 
## 💡 Sobre o Projeto
 
A **Core API do Active Age** é a espinha dorsal de todo o ecossistema de telemedicina. Construída sob a arquitetura RESTful, ela centraliza a lógica de negócios, o armazenamento de dados não-relacionais, e o roteamento de permissões.
 
Esta aplicação atua como o "cérebro" do sistema, processando agendas, emitindo tokens de segurança e comunicando-se de forma assíncrona com microserviços externos (como o de pagamentos) através de Webhooks.
 
---
 
## ✨ Principais Funcionalidades
 
### 🔐 Gestão de Perfis & Autenticação

- **Autenticação Stateless:** Controle de sessão totalmente baseado em Tokens JWT (JSON Web Tokens).

- **Autorização por Papéis (Roles):** Sistema estruturado em 3 níveis de acesso: `PACIENTE`, `MEDICO` e `ADMIN`.

- **Validação de Cadastro:** Bloqueio inteligente de funcionalidades para médicos até que o `ADMIN` aprove oficialmente o CRM na plataforma.
 
### 📅 Motor de Agendamentos

- **Algoritmo Anti-Conflitos:** Lógica restritiva que impede a marcação de consultas que sobreponham o intervalo mínimo de segurança (40 minutos entre atendimentos).

- **Gestão de Horários Livres:** Disponibilização e cancelamento em tempo real de "slots" de agenda na coleção NoSQL de agendamentos.
 
### 📡 Eventos & Cross-Service (Microserviços)

- **Webhook Receiver:** Endpoint exclusivo (`/api/usuarios/medicos/{id}/assinatura/ativar`) configurado para ouvir requisições do Microserviço de Pagamentos e ativar imediatamente a assinatura do médico no banco de dados, ignorando a esteira normal de autenticação por segurança.
 
### 🌱 Data Seeding Dinâmico

- **Semeadura Inteligente:** Classe `DataSeeder` implementada para popular o banco de dados inicial (caso esteja vazio) com perfis fictícios de médicos (usando Lendas da Computação) e geração automática de agendas. Ideal para testes rápidos e bancas de apresentação.
 
---
 
## 🛠️ Tecnologias Utilizadas
 
- **Linguagem:** [Java 21](https://www.oracle.com/java/technologies/downloads/#java21)

- **Framework Principal:** [Spring Boot 3](https://spring.io/projects/spring-boot)

- **Segurança:** [Spring Security](https://spring.io/projects/spring-security) com JWT

- **Banco de Dados:** [MongoDB Atlas](https://www.mongodb.com/atlas) (NoSQL) manipulado via Spring Data MongoDB

- **Gerenciador de Dependências:** [Maven](https://maven.apache.org/)

- **Utilitários:** [Lombok](https://projectlombok.org/) (Redução de Boilerplate code)
 
---
 
## 📁 Estrutura de Pastas (Arquitetura MVC)
 
```bash

src/main/java/com/activeage/api/

├── config/             # Configurações de CORS, WebSecurity e DataSeeder

├── controller/         # Endpoints RESTful e roteamento HTTP (API)

├── dto/                # Data Transfer Objects (Isolamento de payloads e sanitização)

├── enums/              # Constantes fortemente tipadas (Status, Ciclos, etc.)

├── model/              # Entidades mapeadas para Documentos MongoDB (@Document)

├── repository/         # Interfaces de persistência (Spring Data MongoRepository)

├── security/           # Filtros de cadeia do JWT e provedores de autenticação

└── service/            # Camada central com todas as regras de negócios

```

## ⚙️ Como Executar Localmente
 
### Pré-requisitos

- JDK 21 instalado

- Maven instalado

- Uma instância do MongoDB (Local ou Atlas)
 
### Passos

1. Clone este repositório.

2. Na raiz do projeto, configure a variável de ambiente principal definindo a string de conexão:

   `MONGO_URI=mongodb+srv://<usuario>:<senha>@cluster0.mongodb.net/active_age`

3. Execute o comando de inicialização do Maven:

   `mvn spring-boot:run`

4. A API subirá no servidor embutido do Tomcat na porta `8080`.
 
---
 
## 🔒 Segurança e Privacidade
 
- **Criptografia:** Todas as senhas são criptografadas com `BCryptPasswordEncoder` antes da persistência.

- **Isolamento de Dados:** Pacientes não possuem acesso aos endpoints administrativos; rotas sensíveis exigem verificação do `Bearer Token`.
 
---
 
## 📄 Licença
 
Este projeto foi desenvolvido como um sistema acadêmico focado em inovação para saúde digital e arquitetura de microserviços.
 
 
================================================================================
 
# 💳 Active Age — Payment Microservice
 
<p align="center">
<img src="https://img.shields.io/badge/Deploy-Render-black?style=for-the-badge&logo=render" alt="Render Deploy" />
<img src="https://img.shields.io/badge/Java-21-ED8B00?style=for-the-badge&logo=java&logoColor=white" alt="Java 21" />
<img src="https://img.shields.io/badge/Spring_Boot-3-6DB33F?style=for-the-badge&logo=spring-boot&logoColor=white%22 alt="Spring Boot 3" />
<img src="https://img.shields.io/badge/Mercado_Pago-00B1EA?style=for-the-badge&logo=mercado-pago&logoColor=white%22 alt="Mercado Pago" />
<img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>
 
---
 
## 🌐 Microserviço em Produção
 
Acesse o Endpoint base hospedado na nuvem:  

👉 **[https://active-age-payment-service.onrender.com](https://active-age-payment-service.onrender.com)**
 
---
 
## 💡 Sobre o Projeto
 
O **Payment Microservice** é um serviço backend completamente isolado, projetado com foco estrito no Princípio de Responsabilidade Única (SOLID). Sua única função é orquestrar integrações financeiras entre o ecossistema Active Age e os gateways de pagamento.
 
Ao separar a lógica financeira do Backend Principal (Core API), nós garantimos maior segurança, escalabilidade independente e evitamos que falhas no processamento de pagamentos derrubem o sistema de saúde.
 
---
 
## ✨ Principais Funcionalidades
 
### 🛒 Checkout Pro Integrado

- **Geração de Cobranças Dinâmicas:** Recebe os dados de planos mensais ou anuais do Frontend e aciona o SDK oficial do Mercado Pago para gerar links seguros de pagamento, permitindo transações via PIX e Cartões de Crédito.
 
### 📡 Webhook Router (Comunicação Assíncrona)

- **Escuta Ativa:** Endpoint configurado (`/api/payments/webhook`) para receber notificações instantâneas ("IPN") do servidor do Mercado Pago sempre que o status de uma fatura é alterado.

- **Server-to-Server Request:** Quando um pagamento é aprovado, o microserviço atua como um roteador de eventos, utilizando o `HttpClient` nativo do Java para disparar uma requisição HTTP silenciosa e segura para a API Principal, liberando o consultório virtual do médico.
 
### 🐳 Containerização Otimizada

- **Multi-stage Build:** Deploy configurado via `Dockerfile` otimizado, que compila a aplicação no Maven e roda uma imagem limpa e extremamente leve do `Eclipse Temurin 21 JRE`, economizando recursos na nuvem.
 
---
 
## 🛠️ Tecnologias Utilizadas
 
- **Linguagem:** [Java 21](https://www.oracle.com/java/technologies/downloads/#java21)

- **Framework:** [Spring Boot 3](https://spring.io/projects/spring-boot)

- **Integração:** SDK Oficial do Mercado Pago para Java

- **Requisições Nativas:** `java.net.http.HttpClient` (Sem necessidade de bibliotecas de terceiros como Feign ou WebClient)

- **Infraestrutura:** [Docker](https://www.docker.com/)
 
---
 
## 📁 Estrutura de Pastas
 
## 📁 Estrutura de Pastas
 
```bash

payment-service/

├── src/

│   └── main/

│       ├── java/com/activeage/payment/

│       │   ├── controller/

│       │   │   └── PaymentController.java         # Recebe chamadas REST e eventos Webhook

│       │   ├── model/

│       │   │   ├── PaymentIntent.java             # Estrutura de dados enviada pelo Frontend

│       │   │   ├── WebhookNotification.java       # Estrutura do IPN recebida do Mercado Pago

│       │   │   └── ... (Result, Status, Type)     # Enums e retornos de operação

│       │   ├── service/

│       │   │   ├── PaymentService.java            # Interface base de serviços

│       │   │   └── MercadoPagoPaymentService.java # Lógica do SDK e chamadas HTTP pro Core API

│       │   └── PaymentApplication.java            # Inicialização do Spring Boot

│       └── resources/

│           └── application.properties             # Variáveis de ambiente e porta

├── Dockerfile                                     # Script de containerização Multi-stage

└── pom.xml                                        # Gerenciamento de dependências Maven

```
 
---
 
## ⚙️ Como Executar Localmente
 
### Pré-requisitos

- JDK 21 instalado

- Maven instalado

- Uma conta de Desenvolvedor no Mercado Pago (Chave de Acesso)
 
### Passos

1. Clone este repositório.

2. Na raiz do projeto, configure as variáveis de ambiente necessárias (no terminal ou arquivo `.env`):
> `MERCADO_PAGO_ACCESS_TOKEN=sua-chave-de-producao-ou-teste`
> `MAIN_BACKEND_URL=http://localhost:8080` (A URL do seu Backend Principal)

3. Execute a aplicação via terminal:
> `mvn spring-boot:run`

4. A API subirá no servidor embutido na porta `8081`.
 
*Dica:* Para testar Webhooks localmente, utilize uma ferramenta como o **Ngrok** para expor sua porta 8081 para a internet.
 
---
 
## 🔒 Segurança e Privacidade
 
- **Chaves de API Isoladas:** As credenciais financeiras não ficam expostas no Backend Principal, mitigando riscos em caso de brechas.

- **Validação de Assinatura:** Eventos de Webhook podem ser validados quanto à sua origem, garantindo que requisições falsas não consigam ativar assinaturas no sistema de saúde.
 
---
 
## 📄 Licença
 
Este projeto foi desenvolvido como um sistema acadêmico focado em inovação para saúde digital e arquitetura de microserviços.
 
===============================================================================
 
docs: adiciona documentação no README
 
