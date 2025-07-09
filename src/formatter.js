// formatter.js - Versão Corrigida (Regex URL)
// Adaptação das funções de formatação do Apps Script para Node.js

/**
 * Processa texto/markdown para criar blocos do Notion com formatação avançada.
 * @param {string} content - O conteúdo de texto/markdown a ser processado.
 * @returns {Array<object>} - Um array de objetos de bloco do Notion.
 */
function createEnhancedNotionBlocks(content) {
    const blocks = [];
    if (!content) return blocks;

    const sections = content.split(/\n---\n/g);

    sections.forEach((section, index) => {
        if (index > 0) {
            blocks.push({ object: "block", type: "divider", divider: {} });
        }

        const lines = section.trim().split("\n");
        let i = 0;

        while (i < lines.length) {
            const line = lines[i].trim();

            if (line === "") {
                i++;
                continue;
            }

            // Tenta identificar cabeçalhos (#, ##, ###) ou linhas começando com emoji
            const headingMatch = line.match(/^(#{1,3})\s+(.*)/) || line.match(/^([\p{Emoji_Presentation}\p{Emoji}])\s*(.*)/u);
            if (headingMatch) {
                let headingLevel = 3; // Default para h3 ou emoji
                let headingText = line;
                let emojiPrefix = "";

                if (line.startsWith("# ")) {
                    headingLevel = 1;
                    headingText = line.substring(2);
                } else if (line.startsWith("## ")) {
                    headingLevel = 2;
                    headingText = line.substring(3);
                } else if (line.startsWith("### ") || line.startsWith("#### ") || line.startsWith("# ### ")) {
                    headingText = line.substring(4);
                } else if (headingMatch[1] && headingMatch[1].match(/[\p{Emoji_Presentation}\p{Emoji}]/u)) {
                    // Linha começa com emoji, tratar como h3
                    emojiPrefix = headingMatch[1];
                    headingText = headingMatch[2] || "";
                    headingText = `${emojiPrefix} ${headingText}`.trim();
                }

                // Aplica cor de fundo baseada no emoji ou texto
                let backgroundColor = "default";
                const emojiColorMap = getEmojiColorMap();
                const firstEmojiMatch = headingText.match(/^(\p{Emoji_Presentation}|\p{Emoji})/u);
                if (firstEmojiMatch && firstEmojiMatch[0]) {
                    backgroundColor = emojiColorMap[firstEmojiMatch[0]] || "default";
                }
                if (backgroundColor === "default") {
                    backgroundColor = getColorBasedOnText(headingText);
                }

                blocks.push({
                    object: "block",
                    type: `heading_${headingLevel}`,
                    [`heading_${headingLevel}`]: {
                        rich_text: parseRichText(headingText),
                        color: backgroundColor,
                    },
                });
                i++;
                continue;
            }

            // Detecção de Tabelas Markdown (simplificada)
            // Detecção de Tabelas Markdown (ajustada)
            // Detecção de Tabelas Markdown (corrigido Notion)
            if (line.includes("|") && i + 1 < lines.length && lines[i + 1].includes("|") && lines[i + 1].includes("-")) {
                const headerLine = lines[i];
                const separatorLine = lines[i + 1];
                const headers = headerLine.trim().replace(/^\||\|$/g, '').split("|").map(h => h.trim());
                const separatorCols = separatorLine.trim().replace(/^\||\|$/g, '').split("|").map(s => s.trim());

                if (headers.length > 0 && headers.length === separatorCols.length && separatorCols.every(s => /^-+$/.test(s))) {
                    const tableRows = [];
                    // Header
                    tableRows.push({
                        type: "table_row",
                        table_row: {
                            cells: headers.map(header => [{ type: "text", text: { content: header } }])
                        }
                    });
                    i += 2; // Pula header + separador
                    // Dados
                    while (i < lines.length && lines[i].includes("|")) {
                        const dataCells = lines[i].trim().replace(/^\||\|$/g, '').split("|").map(c => c.trim());
                        const cellsContent = headers.map((_, colIndex) => [
                            { type: "text", text: { content: dataCells[colIndex] || "" } }
                        ]);
                        tableRows.push({
                            type: "table_row",
                            table_row: { cells: cellsContent }
                        });
                        i++;
                    }
                    blocks.push({
                        object: "block",
                        type: "table",
                        table: {
                            table_width: headers.length,
                            has_column_header: true,
                            has_row_header: false,
                            children: tableRows,
                        },
                    });
                    continue;
                }
            }



            // Detecção de Lista com Marcadores (* ou -)
            const bulletMatch = line.match(/^([*-])\s+(.*)/);
            if (bulletMatch) {
                blocks.push({
                    object: "block",
                    type: "bulleted_list_item",
                    bulleted_list_item: {
                        rich_text: parseRichText(bulletMatch[2]),
                    }
                });
                i++;
                continue;
            }

            // Detecção de Lista Numerada (1., 2., etc.)
            const numberedMatch = line.match(/^(\d+)\.\s+(.*)/);
            if (numberedMatch) {
                blocks.push({
                    object: "block",
                    type: "numbered_list_item",
                    numbered_list_item: {
                        rich_text: parseRichText(numberedMatch[2]),
                    },
                });
                i++;
                continue;
            }

            // Detecção de Bloco de Código (```)
            if (line.startsWith("```")) {
                const language = line.substring(3).trim() || "plain text";
                let codeContent = "";
                i++;
                while (i < lines.length && !lines[i].startsWith("```")) {
                    codeContent += lines[i] + "\n";
                    i++;
                }
                blocks.push({
                    object: "block",
                    type: "code",
                    code: {
                        rich_text: [{ type: "text", text: { content: codeContent.trimEnd() } }],
                        language: language,
                    },
                });
                if (i < lines.length) i++; // Pula a linha ``` de fechamento
                continue;
            }

            // Detecção de Citação (>)
            const quoteMatch = line.match(/^>\s+(.*)/);
            if (quoteMatch) {
                blocks.push({
                    object: "block",
                    type: "quote",
                    quote: {
                        rich_text: parseRichText(quoteMatch[1]),
                    },
                });
                i++;
                continue;
            }

            // Detecção de Callout (**Título:** Conteúdo)
            const calloutMatch = line.match(/^\*\*(.*?):\*\*\s*(.*)/);
            if (calloutMatch) {
                const calloutTitle = calloutMatch[1];
                const calloutContent = calloutMatch[2];
                const emoji = getEmojiForCallout(calloutTitle); // Usa a função atualizada
                blocks.push({
                    object: "block",
                    type: "callout",
                    callout: {
                        icon: { type: "emoji", emoji: emoji },
                        // Combina título e conteúdo para o rich_text do callout
                        rich_text: parseRichText(`${calloutTitle}: ${calloutContent}`),
                    },
                });
                i++;
                continue;
            }

            // Se não for nenhum dos anteriores, trata como parágrafo
            blocks.push({
                object: "block",
                type: "paragraph",
                paragraph: {
                    rich_text: parseRichText(line),
                },
            });
            i++;
        }
    });

    return blocks;
}

/**
 * Converte texto simples em array rich_text do Notion,
 * tratando links, **negrito** e *itálico*.
 * @param {string} text - Texto a ser processado.
 * @returns {Array<object>} - Array de objetos rich_text.
 */
function parseRichText(text) {
    const parts = [];
    const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|https?:\/\/[^\s]+)/g;
    let lastIndex = 0;
    let match;

    while ((match = tokenRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ content: text.substring(lastIndex, match.index) });
        }
        const token = match[0];
        if (token.startsWith("**")) {
            parts.push({ content: token.slice(2, -2), bold: true });
        } else if (token.startsWith("*")) {
            parts.push({ content: token.slice(1, -1), italic: true });
        } else {
            parts.push({ content: token, link: token });
        }
        lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
        parts.push({ content: text.substring(lastIndex) });
    }

    if (parts.length === 0) {
        parts.push({ content: text });
    }

    return parts.map(p => ({
        type: "text",
        text: { content: p.content, ...(p.link ? { link: { url: p.link } } : {}) },
        ...(p.bold || p.italic ? {
            annotations: {
                bold: !!p.bold,
                italic: !!p.italic,
                strikethrough: false,
                underline: false,
                code: false,
                color: "default",
            },
        } : {}),
    }));
}


/**
 * Retorna um emoji apropriado com base no título do callout.
 * (Biblioteca de emojis COMPLETA adaptada do script original)
 * @param {string} title - Título do callout.
 * @returns {string} - Emoji correspondente.
 */
function getEmojiForCallout(title) {
    const lowerTitle = title.toLowerCase();

    // TECNOLOGIA E DESENVOLVIMENTO
    if (lowerTitle.includes("arquitetura de software")) return "🏛️";
    if (lowerTitle.includes("design")) return "🎨";
    if (lowerTitle.includes("padrão") || lowerTitle.includes("pattern")) return "📐";
    if (lowerTitle.includes("estrutura")) return "🧱";
    if (lowerTitle.includes("camada") || lowerTitle.includes("layer")) return "🧁";
    if (lowerTitle.includes("monolítica") || lowerTitle.includes("monolito")) return "🗿";
    if (lowerTitle.includes("microserviço") || lowerTitle.includes("microservice")) return "🧩";
    if (lowerTitle.includes("serverless")) return "☁️";
    if (lowerTitle.includes("api")) return "🔌";
    if (lowerTitle.includes("onion")) return "🧅";
    if (lowerTitle.includes("rest")) return "🔄";
    if (lowerTitle.includes("graphql")) return "📊";
    if (lowerTitle.includes("mvc")) return "🔺";
    if (lowerTitle.includes("mvvm")) return "🔷";
    if (lowerTitle.includes("horizontal")) return "🔀";
    if (lowerTitle.includes("vertical")) return "🔼";
    if (lowerTitle.includes("escala") || lowerTitle.includes("scale")) return "📈";
    if (lowerTitle.includes("performance")) return "⚡";
    if (lowerTitle.includes("latência") || lowerTitle.includes("latency")) return "⏱️";
    if (lowerTitle.includes("throughput")) return "🚀";
    if (lowerTitle.includes("carga") || lowerTitle.includes("load")) return "⚖️";
    if (lowerTitle.includes("capacidade")) return "🧮";
    if (lowerTitle.includes("balanceador") || lowerTitle.includes("load balancer")) return "⚖️";
    if (lowerTitle.includes("container") || lowerTitle.includes("docker")) return "📦";
    if (lowerTitle.includes("kubernetes") || lowerTitle.includes("k8s")) return "🎮";
    if (lowerTitle.includes("ci") || lowerTitle.includes("cd") || lowerTitle.includes("pipeline")) return "🔄";
    if (lowerTitle.includes("deploy") || lowerTitle.includes("implantação")) return "🚀";
    if (lowerTitle.includes("infraestrutura") || lowerTitle.includes("infrastructure")) return "🏗️";
    if (lowerTitle.includes("cloud") || lowerTitle.includes("nuvem")) return "☁️";
    if (lowerTitle.includes("aws")) return "🟧";
    if (lowerTitle.includes("azure")) return "🟦";
    if (lowerTitle.includes("gcp") || lowerTitle.includes("google cloud")) return "🟥";
    if (lowerTitle.includes("terraform")) return "🏔️";
    if (lowerTitle.includes("ansible")) return "🎭";
    if (lowerTitle.includes("vagrant")) return "📦";
    if (lowerTitle.includes("jenkins")) return "👷";
    if (lowerTitle.includes("banco") || lowerTitle.includes("database")) return "🗄️";
    if (lowerTitle.includes("sql")) return "📊";
    if (lowerTitle.includes("nosql")) return "📓";
    if (lowerTitle.includes("postgres") || lowerTitle.includes("postgresql")) return "🐘";
    if (lowerTitle.includes("mysql")) return "🐬";
    if (lowerTitle.includes("oracle")) return "🏛️";
    if (lowerTitle.includes("mongodb")) return "🍃";
    if (lowerTitle.includes("cassandra")) return "👁️";
    if (lowerTitle.includes("redis")) return "🔴";
    if (lowerTitle.includes("elasticsearch")) return "🔍";
    if (lowerTitle.includes("neo4j")) return "🕸️";
    if (lowerTitle.includes("sharding")) return "🧩";
    if (lowerTitle.includes("replicação") || lowerTitle.includes("replication")) return "🔄";
    if (lowerTitle.includes("transação") || lowerTitle.includes("transaction")) return "🔒";
    if (lowerTitle.includes("acid")) return "⚗️";
    if (lowerTitle.includes("orm")) return "🔗";
    if (lowerTitle.includes("monitoramento") || lowerTitle.includes("monitoring")) return "📊";
    if (lowerTitle.includes("observabilidade") || lowerTitle.includes("observability")) return "👁️";
    if (lowerTitle.includes("log")) return "📝";
    if (lowerTitle.includes("métrica") || lowerTitle.includes("metric")) return "📏";
    if (lowerTitle.includes("alerta") || lowerTitle.includes("alert")) return "🚨";
    if (lowerTitle.includes("prometheus")) return "🔥";
    if (lowerTitle.includes("grafana")) return "📊";
    if (lowerTitle.includes("kibana")) return "🔍";
    if (lowerTitle.includes("cloudwatch")) return "☁️";
    if (lowerTitle.includes("apm")) return "💓";
    if (lowerTitle.includes("trace") || lowerTitle.includes("tracing")) return "🔍";
    if (lowerTitle.includes("jaeger")) return "👁️";
    if (lowerTitle.includes("zipkin")) return "⚡";
    if (lowerTitle.includes("cache")) return "⚡";
    if (lowerTitle.includes("cdn")) return "🌐";
    if (lowerTitle.includes("memcached")) return "🧠";
    if (lowerTitle.includes("varnish")) return "🚀";
    if (lowerTitle.includes("cloudflare")) return "☁️";
    if (lowerTitle.includes("akamai")) return "🌐";
    if (lowerTitle.includes("fastly")) return "⚡";
    if (lowerTitle.includes("java")) return "☕";
    if (lowerTitle.includes("spring")) return "🍃";
    if (lowerTitle.includes("quarkus")) return "⚛️";
    if (lowerTitle.includes("micronaut")) return "🔬";
    if (lowerTitle.includes("node") || lowerTitle.includes("nodejs")) return "🟢";
    if (lowerTitle.includes("express")) return "🚂";
    if (lowerTitle.includes("nestjs")) return "🐈";
    if (lowerTitle.includes("javascript") || lowerTitle.includes("js")) return "🟨";
    if (lowerTitle.includes("typescript") || lowerTitle.includes("ts")) return "🔷";
    if (lowerTitle.includes("python")) return "🐍";
    if (lowerTitle.includes("django")) return "🎸";
    if (lowerTitle.includes("flask")) return "🧪";
    if (lowerTitle.includes("fastapi")) return "⚡";
    if (lowerTitle.includes("go") || lowerTitle.includes("golang")) return "🐹";
    if (lowerTitle.includes("rust")) return "🦀";
    if (lowerTitle.includes("c#") || lowerTitle.includes("csharp") || lowerTitle.includes("dotnet")) return "🟪";
    if (lowerTitle.includes("php")) return "🐘";
    if (lowerTitle.includes("laravel")) return "🔴";
    if (lowerTitle.includes("ruby")) return "💎";
    if (lowerTitle.includes("rails")) return "🛤️";
    if (lowerTitle.includes("kotlin")) return "🟣";
    if (lowerTitle.includes("swift")) return "🐦";
    if (lowerTitle.includes("react")) return "⚛️";
    if (lowerTitle.includes("angular")) return "🔺";
    if (lowerTitle.includes("vue")) return "🟩";
    if (lowerTitle.includes("svelte")) return "🟠";
    if (lowerTitle.includes("segurança") || lowerTitle.includes("security")) return "🔒";
    if (lowerTitle.includes("autenticação") || lowerTitle.includes("authentication")) return "🔑";
    if (lowerTitle.includes("autorização") || lowerTitle.includes("authorization")) return "🛡️";
    if (lowerTitle.includes("oauth")) return "🔐";
    if (lowerTitle.includes("jwt")) return "🎟️";
    if (lowerTitle.includes("criptografia") || lowerTitle.includes("encryption")) return "🔏";
    if (lowerTitle.includes("ssl") || lowerTitle.includes("tls")) return "🔒";
    if (lowerTitle.includes("firewall")) return "🧱";
    if (lowerTitle.includes("waf")) return "🛡️";
    if (lowerTitle.includes("ddos")) return "🌊";
    if (lowerTitle.includes("pentest")) return "🕵️";
    if (lowerTitle.includes("vulnerabilidade") || lowerTitle.includes("vulnerability")) return "🐛";
    if (lowerTitle.includes("owasp")) return "🕸️";
    if (lowerTitle.includes("agile") || lowerTitle.includes("ágil")) return "🏃";
    if (lowerTitle.includes("scrum")) return "🏉";
    if (lowerTitle.includes("kanban")) return "📋";
    if (lowerTitle.includes("xp") || lowerTitle.includes("extreme programming")) return "🧗";
    if (lowerTitle.includes("devops")) return "♾️";
    if (lowerTitle.includes("sre")) return "🛠️";
    if (lowerTitle.includes("tdd")) return "🧪";
    if (lowerTitle.includes("bdd")) return "🧩";
    if (lowerTitle.includes("ddd")) return "🧠";
    if (lowerTitle.includes("clean code")) return "🧹";
    if (lowerTitle.includes("solid")) return "🧱";
    if (lowerTitle.includes("refactoring") || lowerTitle.includes("refatoração")) return "♻️";
    if (lowerTitle.includes("code review") || lowerTitle.includes("revisão de código")) return "👁️";
    if (lowerTitle.includes("pair programming") || lowerTitle.includes("programação em par")) return "👥";
    if (lowerTitle.includes("teste") || lowerTitle.includes("test")) return "🧪";
    if (lowerTitle.includes("unit") || lowerTitle.includes("unitário")) return "🔬";
    if (lowerTitle.includes("integration") || lowerTitle.includes("integração")) return "🔗";
    if (lowerTitle.includes("e2e") || lowerTitle.includes("end-to-end")) return "🔄";
    if (lowerTitle.includes("stress")) return "💥";
    if (lowerTitle.includes("chaos") || lowerTitle.includes("caos")) return "🌪️";
    if (lowerTitle.includes("mock")) return "🎭";
    if (lowerTitle.includes("stub")) return "🧩";
    if (lowerTitle.includes("selenium")) return "🤖";
    if (lowerTitle.includes("cypress")) return "🌲";
    if (lowerTitle.includes("jest")) return "🃏";
    if (lowerTitle.includes("junit")) return "☕";
    if (lowerTitle.includes("pytest")) return "🐍";

    // NEGÓCIOS E GESTÃO
    if (lowerTitle.includes("projeto") || lowerTitle.includes("project")) return "📋";
    if (lowerTitle.includes("gerenciamento") || lowerTitle.includes("management")) return "📊";
    if (lowerTitle.includes("planejamento") || lowerTitle.includes("planning")) return "📅";
    if (lowerTitle.includes("cronograma") || lowerTitle.includes("schedule")) return "⏰";
    if (lowerTitle.includes("orçamento") || lowerTitle.includes("budget")) return "💰";
    if (lowerTitle.includes("risco") || lowerTitle.includes("risk")) return "⚠️";
    if (lowerTitle.includes("stakeholder")) return "👥";
    if (lowerTitle.includes("milestone") || lowerTitle.includes("marco")) return "🏁";
    if (lowerTitle.includes("entrega") || lowerTitle.includes("delivery")) return "📦";
    if (lowerTitle.includes("sprint")) return "🏃";
    if (lowerTitle.includes("backlog")) return "📝";
    if (lowerTitle.includes("retrospectiva") || lowerTitle.includes("retrospective")) return "🔄";
    if (lowerTitle.includes("daily") || lowerTitle.includes("diária")) return "☀️";
    if (lowerTitle.includes("pmo")) return "🏢";
    if (lowerTitle.includes("gantt")) return "📊";
    if (lowerTitle.includes("estratégia") || lowerTitle.includes("strategy")) return "♟️";
    if (lowerTitle.includes("negócio") || lowerTitle.includes("business")) return "💼";
    if (lowerTitle.includes("modelo") || lowerTitle.includes("model")) return "🧩";
    if (lowerTitle.includes("canvas")) return "🖼️";
    if (lowerTitle.includes("missão") || lowerTitle.includes("mission")) return "🚩";
    if (lowerTitle.includes("visão") || lowerTitle.includes("vision")) return "👁️";
    if (lowerTitle.includes("valor") || lowerTitle.includes("value")) return "💎";
    if (lowerTitle.includes("objetivo") || lowerTitle.includes("goal")) return "🎯";
    if (lowerTitle.includes("kpi")) return "📊";
    if (lowerTitle.includes("okr")) return "🎯";
    if (lowerTitle.includes("swot")) return "🧮";
    if (lowerTitle.includes("pestel")) return "🌍";
    if (lowerTitle.includes("porter")) return "🔨";
    if (lowerTitle.includes("lean")) return "⚡";
    if (lowerTitle.includes("startup")) return "🚀";
    if (lowerTitle.includes("pivot")) return "🔄";
    if (lowerTitle.includes("mvp")) return "🔍";
    if (lowerTitle.includes("inovação") || lowerTitle.includes("innovation")) return "💡";
    if (lowerTitle.includes("marketing")) return "📣";
    if (lowerTitle.includes("venda") || lowerTitle.includes("sale")) return "💰";
    if (lowerTitle.includes("cliente") || lowerTitle.includes("customer")) return "👥";
    if (lowerTitle.includes("persona")) return "🎭";
    if (lowerTitle.includes("jornada") || lowerTitle.includes("journey")) return "🛤️";
    if (lowerTitle.includes("funil") || lowerTitle.includes("funnel")) return "🔽";
    if (lowerTitle.includes("lead")) return "🎣";
    if (lowerTitle.includes("conversão") || lowerTitle.includes("conversion")) return "🔄";
    if (lowerTitle.includes("campanha") || lowerTitle.includes("campaign")) return "📢";
    if (lowerTitle.includes("marca") || lowerTitle.includes("brand")) return "™️";
    if (lowerTitle.includes("social media") || lowerTitle.includes("mídia social")) return "📱";
    if (lowerTitle.includes("seo")) return "🔍";
    if (lowerTitle.includes("sem")) return "💰";
    if (lowerTitle.includes("cro")) return "📈";
    if (lowerTitle.includes("cta")) return "👆";
    if (lowerTitle.includes("roi")) return "💹";
    if (lowerTitle.includes("cac")) return "💸";
    if (lowerTitle.includes("ltv")) return "📊";
    if (lowerTitle.includes("nps")) return "⭐";
    if (lowerTitle.includes("crm")) return "🤝";
    if (lowerTitle.includes("rh") || lowerTitle.includes("hr")) return "👥";
    if (lowerTitle.includes("recrutamento") || lowerTitle.includes("recruitment")) return "🎯";
    if (lowerTitle.includes("seleção") || lowerTitle.includes("selection")) return "✅";
    if (lowerTitle.includes("onboarding")) return "🚪";
    if (lowerTitle.includes("treinamento") || lowerTitle.includes("training")) return "🏋️";
    if (lowerTitle.includes("desenvolvimento") || lowerTitle.includes("development")) return "📈";
    if (lowerTitle.includes("carreira") || lowerTitle.includes("career")) return "🪜";
    if (lowerTitle.includes("feedback")) return "💬";
    if (lowerTitle.includes("avaliação") || lowerTitle.includes("evaluation")) return "📋";
    if (lowerTitle.includes("remuneração") || lowerTitle.includes("compensation")) return "💰";
    if (lowerTitle.includes("benefício") || lowerTitle.includes("benefit")) return "🎁";
    if (lowerTitle.includes("cultura") || lowerTitle.includes("culture")) return "🌱";
    if (lowerTitle.includes("engajamento") || lowerTitle.includes("engagement")) return "🔥";
    if (lowerTitle.includes("retenção") || lowerTitle.includes("retention")) return "🧲";
    if (lowerTitle.includes("turnover")) return "🔄";
    if (lowerTitle.includes("diversidade") || lowerTitle.includes("diversity")) return "🌈";
    if (lowerTitle.includes("inclusão") || lowerTitle.includes("inclusion")) return "🤝";
    if (lowerTitle.includes("finança") || lowerTitle.includes("finance")) return "💰";
    if (lowerTitle.includes("contabilidade") || lowerTitle.includes("accounting")) return "📒";
    if (lowerTitle.includes("receita") || lowerTitle.includes("revenue")) return "💵";
    if (lowerTitle.includes("despesa") || lowerTitle.includes("expense")) return "💸";
    if (lowerTitle.includes("lucro") || lowerTitle.includes("profit")) return "💹";
    if (lowerTitle.includes("prejuízo") || lowerTitle.includes("loss")) return "📉";
    if (lowerTitle.includes("balanço") || lowerTitle.includes("balance")) return "⚖️";
    if (lowerTitle.includes("fluxo de caixa") || lowerTitle.includes("cash flow")) return "💧";
    if (lowerTitle.includes("investimento") || lowerTitle.includes("investment")) return "📈";
    if (lowerTitle.includes("ativo") || lowerTitle.includes("asset")) return "💎";
    if (lowerTitle.includes("passivo") || lowerTitle.includes("liability")) return "⛓️";
    if (lowerTitle.includes("patrimônio") || lowerTitle.includes("equity")) return "🏛️";
    if (lowerTitle.includes("imposto") || lowerTitle.includes("tax")) return "📝";
    if (lowerTitle.includes("auditoria") || lowerTitle.includes("audit")) return "🔍";
    if (lowerTitle.includes("forecast")) return "🔮";

    // EDUCAÇÃO E CIÊNCIA
    if (lowerTitle.includes("educação") || lowerTitle.includes("education")) return "🎓";
    if (lowerTitle.includes("aprendizado") || lowerTitle.includes("learning")) return "📚";
    if (lowerTitle.includes("ensino") || lowerTitle.includes("teaching")) return "👨‍🏫";
    if (lowerTitle.includes("curso") || lowerTitle.includes("course")) return "📝";
    if (lowerTitle.includes("aula") || lowerTitle.includes("class")) return "🏫";
    if (lowerTitle.includes("estudo") || lowerTitle.includes("study")) return "📖";
    if (lowerTitle.includes("pesquisa") || lowerTitle.includes("research")) return "🔬";
    if (lowerTitle.includes("ciência") || lowerTitle.includes("science")) return "🔬";
    if (lowerTitle.includes("experimento") || lowerTitle.includes("experiment")) return "🧪";
    if (lowerTitle.includes("hipótese") || lowerTitle.includes("hypothesis")) return "🤔";
    if (lowerTitle.includes("teoria") || lowerTitle.includes("theory")) return "🧠";
    if (lowerTitle.includes("matemática") || lowerTitle.includes("math")) return "🧮";
    if (lowerTitle.includes("física") || lowerTitle.includes("physics")) return "⚛️";
    if (lowerTitle.includes("química") || lowerTitle.includes("chemistry")) return "⚗️";
    if (lowerTitle.includes("biologia") || lowerTitle.includes("biology")) return "🧬";
    if (lowerTitle.includes("história") || lowerTitle.includes("history")) return "📜";
    if (lowerTitle.includes("geografia") || lowerTitle.includes("geography")) return "🌍";
    if (lowerTitle.includes("literatura") || lowerTitle.includes("literature")) return "📖";
    if (lowerTitle.includes("filosofia") || lowerTitle.includes("philosophy")) return "🤔";

    // GERAL E CONCEITUAL
    if (lowerTitle.includes("importante") || lowerTitle.includes("important")) return "⚠️";
    if (lowerTitle.includes("atenção") || lowerTitle.includes("attention")) return "❗";
    if (lowerTitle.includes("cuidado") || lowerTitle.includes("warning")) return "☢️";
    if (lowerTitle.includes("dica") || lowerTitle.includes("tip")) return "💡";
    if (lowerTitle.includes("sugestão") || lowerTitle.includes("suggestion")) return "🙋";
    if (lowerTitle.includes("ideia") || lowerTitle.includes("idea")) return "💡";
    if (lowerTitle.includes("definição") || lowerTitle.includes("definition")) return "📖";
    if (lowerTitle.includes("conceito") || lowerTitle.includes("concept")) return "🧠";
    if (lowerTitle.includes("exemplo") || lowerTitle.includes("example")) return "✅";
    if (lowerTitle.includes("vantagem") || lowerTitle.includes("advantage")) return "👍";
    if (lowerTitle.includes("desvantagem") || lowerTitle.includes("disadvantage")) return "👎";
    if (lowerTitle.includes("prós") || lowerTitle.includes("pros")) return "➕";
    if (lowerTitle.includes("contras") || lowerTitle.includes("cons")) return "➖";
    if (lowerTitle.includes("comparação") || lowerTitle.includes("comparison")) return "⚖️";
    if (lowerTitle.includes("resumo") || lowerTitle.includes("summary")) return "📝";
    if (lowerTitle.includes("conclusão") || lowerTitle.includes("conclusion")) return "🏁";
    if (lowerTitle.includes("próximo passo") || lowerTitle.includes("next step")) return "➡️";
    if (lowerTitle.includes("referência") || lowerTitle.includes("reference")) return "📚";
    if (lowerTitle.includes("recurso") || lowerTitle.includes("resource")) return "🔗";
    if (lowerTitle.includes("pergunta") || lowerTitle.includes("question")) return "❓";
    if (lowerTitle.includes("resposta") || lowerTitle.includes("answer")) return "✔️";
    if (lowerTitle.includes("problema") || lowerTitle.includes("problem")) return "❗";
    if (lowerTitle.includes("solução") || lowerTitle.includes("solution")) return "💡";

    // Emoji padrão
    return "ℹ️";
}

/**
 * Retorna o mapa de emojis para cores de fundo de cabeçalho.
 * @returns {object}
 */
function getEmojiColorMap() {
    // Mapeamento completo (pode ser ajustado conforme preferência)
    return {
        "🎯": "red_background", "🚀": "red_background", "📌": "red_background", "🔍": "red_background", "📝": "red_background",
        "🧩": "blue_background", "📘": "blue_background", "🔠": "blue_background", "📚": "blue_background", "📖": "blue_background",
        "🏗️": "orange_background", "🧱": "orange_background", "🏢": "orange_background", "🔧": "orange_background", "🏛️": "orange_background",
        "⚖️": "yellow_background", "🔄": "yellow_background", "⚙️": "yellow_background", "🔁": "yellow_background", "🔃": "yellow_background",
        "💼": "green_background", "📊": "green_background", "📈": "green_background", "🏭": "green_background", "🏪": "green_background",
        "🛠️": "purple_background", "⚒️": "purple_background", "🔨": "purple_background", "🧰": "purple_background",
        "👨‍💻": "pink_background", "👩‍💻": "pink_background", "💻": "pink_background", "⌨️": "pink_background", "🖥️": "pink_background",
        "🧠": "brown_background", "🤔": "brown_background", "💭": "brown_background", "🔮": "brown_background", "🎲": "brown_background",
        "📑": "gray_background", "📰": "gray_background", "📋": "gray_background", "📒": "gray_background",
        // Adicionando alguns do mapeamento de callouts para consistência
        "⚠️": "yellow_background", "❗": "red_background", "💡": "blue_background", "✅": "green_background", "👍": "green_background", "👎": "red_background",
        "➕": "green_background", "➖": "red_background", "🏁": "gray_background", "➡️": "blue_background", "❓": "purple_background", "✔️": "green_background"
    };
}

/**
 * Determina a cor de fundo do cabeçalho com base em palavras-chave.
 * @param {string} headingText - Texto do cabeçalho.
 * @returns {string} - Cor de fundo do Notion ou "default".
 */
function getColorBasedOnText(headingText) {
    const lowerText = headingText.toLowerCase();
    if (lowerText.includes("objetivo") || lowerText.includes("meta") || lowerText.includes("resumo") || lowerText.includes("introdução")) return "red_background";
    if (lowerText.includes("definição") || lowerText.includes("conceito") || lowerText.includes("significado")) return "blue_background";
    if (lowerText.includes("estrutura") || lowerText.includes("arquitetura") || lowerText.includes("tipo") || lowerText.includes("camada")) return "orange_background";
    if (lowerText.includes("vantagem") || lowerText.includes("limitação") || lowerText.includes("comparação") || lowerText.includes("versus") || lowerText.includes("prós") || lowerText.includes("contras")) return "yellow_background";
    if (lowerText.includes("caso") || lowerText.includes("exemplo") || lowerText.includes("uso") || lowerText.includes("aplicação")) return "green_background";
    if (lowerText.includes("ferramenta") || lowerText.includes("tecnologia") || lowerText.includes("técnica")) return "purple_background";
    if (lowerText.includes("código") || lowerText.includes("exemplo prático") || lowerText.includes("implementação")) return "pink_background";
    if (lowerText.includes("quando usar") || lowerText.includes("decisão") || lowerText.includes("escolha") || lowerText.includes("evitar")) return "brown_background";
    if (lowerText.includes("referência") || lowerText.includes("leitura") || lowerText.includes("bibliografia") || lowerText.includes("conclusão")) return "gray_background";
    return "default";
}

// Exporta as funções necessárias para o index.js
module.exports = { createEnhancedNotionBlocks, parseRichText, getEmojiForCallout };

