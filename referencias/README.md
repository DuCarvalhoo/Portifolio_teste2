# CONSTRUCTION 3D — implementação demonstrativa

## Arquivos analisados
Fornecidos: index.html, construction.js e imagem de referência. Base original: HTML + JavaScript ESM + Three.js 0.170.0, OrbitControls e import map. Não há React, package.json, roteador ou fonte do portfólio completo. O CSS ../../projects.css não foi fornecido.

Problemas encontrados: 18 grupos visuais controlados por 17 índices; entrega final ficava fora do percurso. Planta original de 10 x 7 m divergente dos 120 m² anunciados. Paredes eram caixas contínuas sem vãos reais. Modos técnicos ausentes. CSS externo ausente.

## Integração segura
Copiar somente a pasta projetos/construction-3d para a raiz do portfólio. Não sobrescrever index.html da raiz. Inserir o trecho card-integracao.html na seção existente. Ajustar somente classes do card caso necessário. A integração da página inicial não foi executada porque o arquivo do portfólio completo não foi fornecido.

## Executar
Na raiz do portfólio: python -m http.server 8000
Abrir http://localhost:8000/projetos/construction-3d/
A rota sem barra depende do redirecionamento de diretórios do servidor; com servidor estático convencional, index.html é o documento do diretório. Em hospedagens SPA configure a exceção para esta pasta antes do fallback geral.

Motor e controles usam CDN, exigindo internet. Para feira sem internet: baixar three.module.js e os módulos addons e dependências de Three.js 0.170.0 para vendor, e alterar as entradas do import map. Esses arquivos externos não estão incluídos neste pacote.

## Modelo
Cena única persistente, grupos por etapa, envelope 12 x 10 m demonstrativo e garagem exterior. Alvenarias segmentadas geram vãos reais. Sala, cozinha, dois quartos, banheiro e serviço compartilham a mesma planta em todas as etapas. Fundação e armaduras são apenas representação conceitual, sem validação técnica. Redes são esquemáticas e não constituem projeto hidráulico/elétrico. Não há cálculo de quantitativos, orçamento ou cargas.

## Recursos
17 fases, navegação manual, reprodução, pausa, velocidade, reinício, câmera orbital com toque/zoom, vistas superior/lateral/perspectiva, rotação automática e modos completo/externo/planta/estrutura/instalações. Painel didático, progresso de percurso e estados na linha do tempo. Novos grupos crescem verticalmente; não há simulação física de operários nem execução detalhada de cada serviço. Limpeza remove elementos do terreno, canteiro temporário é ocultado após fundações, pintura altera o material das mesmas paredes. Modelagem estilizada, não fotorrealista; não há texturas fotográficas.

## Testes
Ver TESTES.md. Testes estáticos executados durante geração. Não foi possível executar navegador/WebGL ou aparelhos físicos neste ambiente. Compatibilidade, desempenho e qualidade visual exigem homologação no navegador; não considerar aprovação de produção.

## Preservação
Originais em originais/ para comparação. Nenhum arquivo remoto foi modificado ou publicado.
