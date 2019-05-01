# UFSMBot-Node.js

Este projeto foi criado com propósitos educacionais.

>Qualquer sugestão de nome melhor é bem vindo

[![](https://img.shields.io/badge/app-online-brightgreen.svg)](https://ufsmbot.herokuapp.com) [![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/danieldspx/UFSMBot-NodeJS/issues) [![](http://inch-ci.org/github/danieldspx/UFSMBot-NodeJS.svg?branch=develop)](http://inch-ci.org/github/danieldspx/UFSMBot-NodeJS)

## To-Do

 - Lista de exceções (A pessoa pode colocar um dia em especifico em que sabe que não vai comparecer. Desse modo o BOT ignoraria esse dia mesmo que ele estivesse presente na rotina)

## Instalação
Para poder rodar este projeto localmente você vai precisar do:
 - Node
 - NPM

Quando ambos estiverem instalados é preciso instalar o TypeScript:

    npm install -g typescript

## Executar aplicação

### Dependências

Instale todas as dependências necessárias

    npm install

### Configurar variáveis de ambiente
No arquivo `.env` você deverá configurar a chave (na variável  `CRYPTOKEY`)para a criptografia que é utilizada para salvar as senhas no banco de dados (o algoritmo utilizado é o AES-128). Para poder utilizar esse arquivo `.env` é necessário adicionar o ao arquivo `index.ts`, no começo dele (coloque na seção de Requires), o código:

    require('dotenv').config();

### Criação do banco de dados

Este projeto usa o Firebase, mais especificamente o Cloud Firestore, para salvar os dados de forma segura. Desse modo é necessário criar um projeto no Firebase e configurar o projeto com as credenciais do novo projeto. Para isso acesse o site do [Firebase](https://console.firebase.google.com).

Após adicionar um novo projeto vá em

    Project Overview > Settings > Configurações do Projeto > Contas de Serviço > SDK Admin do Firebase

![](https://imgur.com/bDkHoqi.png)

Feito isso clique no botão para baixar a sua chave privada. Renomeie o arquivo para `serviceAccountKey.json` e coloque-o na pasta `/config` do projeto. O arquivo deve ser algo assim:

![](https://imgur.com/4STucun.png)

Essas credenciais não podem ser expostas pois qualquer um com estas credenciais podem acessar o seu banco de dados e por padrão as aplicações com essas credenciais conseguem passar por cima das regras do Cloud Firestore, desse modo seria necessário gerar outro arquivo como esse, no mesmo lugar.

### Transpilar projeto
Este projeto foi criado o TypeScript que no final é transpilado para JavaScript. Existem muitas vantagens em usar o TypeScript pois ele indica erros e auto completa as propriedades de um objeto (O que não ocorre com vanilla js). É importante que você também instale o Linter do TypeScript do seu editor.

Para transpilar o arquivo `index.ts`( que é onde todo o código do Back-End se encontra) para `index.js` devemos digitar no terminal, na pasta do projeto o comando:

    tsc index.ts

Gerado o arquivo `index.js`.

### Rodando a aplicação
Primeiramente precisamos trocar a linha

    app.use(requireHTTPS, express.json(), express.static('public'), cors());
Por:

    app.use(express.json(), express.static('public'), cors());

Veja que apenas removemos o requireHTTPS, pois isso só é valido quando colocamos em uma hospedagem, como por exemplo o Heroku.

Agora executar o arquivo `index.js` que foi gerado pelo compilador TypeScript. Para isto basta executar o comando:

    node index.js

Lembre-se que o arquivo que o node roda é o `index.js`, entretanto todas nossas alterações de código são feitas no `index.ts`. Desse modo facilita se você juntar o comando de do TS com o do node para sempre garantir que o que você está rodando está de acordo com as alterações do arquivo TS.

Desse modo o mais conveniente é usar

    tsc index.ts && node index.js

![](https://imgur.com/JWwve3E.png)

Pronto! O servidor está funcionando e já pode acessar o seu banco de dados, entretanto o Front-end está funcionando para a aplicação principal em [https://ufsmbot.herokuapp.com](https://ufsmbot.herokuapp.com/), desse modo o correto seria você acessar o projeto do Front-end e colocar as suas credenciais públicas para o projeto Front-end acessar o seu banco de dados, fazer o build para a produção e depois jogar na pasta `/public` do Back-end

  Para acessar a interface gráfica basta digitar no seu navegador:


    localhost:5000

 Se você quiser fazer alterações no Front-end você deve alterar no projeto do [UFSMBot-Angular](https://github.com/danieldspx/UFSMBot-Angular). [Acesse o projeto](https://github.com/danieldspx/UFSMBot-Angular) para saber como fazer isso.
