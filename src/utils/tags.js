const natural = require('natural');

const STOPWORDS = [
    "exemplo", "conclusao", "introducao", "vantagens", "desvantagens", "quando usar",
    "referencias", "objetivo", "casos", "caso", "pratico", "praticos", "teorico", "leitura",
    "resumo", "tema", "passos", "pontos", "importante", "dica", "nota", "final", "etc",
    "e", "de", "com", "como", "a", "o", "os", "as", "um", "uma", "para", "em",
    "no", "na", "nos", "nas", "dos", "das", "do", "da", "por", "pelos", "pelas", "pelo", "pela",
    "eu", "meu", "minha", "meus", "minhas", "mim", "comigo",
    "voce", "vc", "teu", "tua", "teus", "tuas", "te", "contigo", "seu", "sua", "seus", "suas",
    "nos", "nosso", "nossa", "nossos", "nossas", "conosco",
    "voces", "vossos", "vossas", "vosso", "vossa", "convosco",
    "ele", "ela", "eles", "elas", "lhe", "lhes", "deles", "delas", "dele", "dela", "se", "si", "consigo",
    "e", "sao", "foi", "foram", "era", "eram", "ser", "esta", "estao", "estava", "estavam", "estar",
    "tem", "tem", "tenho", "temos", "tinha", "tinham", "havia", "houveram", "vai", "vao", "vamos", "ir",
    "que", "isso", "aquilo", "isto", "deste", "desta", "daquele", "daquela", "desse", "dessa", "nesse", "nessa", "neste", "nesta", "qual", "quais", "onde", "quando", "quem", "porque", "por que", "cujo", "cuja", "cujos", "cujas", "seja", "sejam", "foi", "fui", "sou", "sao", "tudo", "cada",
    "the", "a", "an", "and", "but", "or", "if", "in", "on", "at", "to", "for", "with", "by", "about",
    "this", "that", "these", "those", "it", "its", "they", "them", "their", "there", "where", "when", "who", "whom", "which", "what",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "shall", "can", "could", "may", "might", "must", "should", "ought", "need", "dare",
    "just", "only", "even", "still", "yet", "already"
];

const EXTRA_STOPWORDS = [
    "teste", "tessssss", "preliminar", "conclusao preliminar", "lises", "ajustes",
    "estrutura", "estrutura esperada", "evolu", "justificativa", "introducao",
    "consideracoes finais", "detalhada", "atual", "observacoes", "sessao",
    "diretorios", "pergunta", "resposta", "sessao", "nota", "importante", "finais",
    "detalhes", "dados", "real", "mais", "conta", "email", "perfil", "dados",
    "complementar", "sessao", "temas", "alertas", "feedback", "registro", "opcao", "Sistema", "Home", "Configuracoes", "Configuracao", "Configuracoes do Sistema"
];

const ALL_STOPWORDS = STOPWORDS.concat(EXTRA_STOPWORDS);
const stopSet = new Set(ALL_STOPWORDS.map(w => w.toLowerCase()));

function isTagOk(tag) {
    if (!tag || typeof tag !== 'string') return false;
    const tagClean = tag.trim().toLowerCase();
    if (stopSet.has(tagClean)) return false;
    if (tagClean.length < 4 && !['mvp', 'api', 'crm', 'sql'].includes(tagClean)) return false;
    const palavras = tag.split(/\s+/).filter(w => !stopSet.has(w));
    if (palavras.length > 3 || palavras.length === 0) return false;
    if (palavras.every(w => stopSet.has(w.toLowerCase()))) return false;
    if (/^[A-Z]{4,}$/.test(tag) && !['MVP', 'API'].includes(tag)) return false;
    if (new Set(palavras).size < palavras.length) return false;
    return true;
}

function reconcileTags(tagsDesejadas, options) {
    return tagsDesejadas.map(t => {
        if (t.id && options.some(opt => opt.id === t.id)) {
            return { id: t.id };
        }
        const opt = options.find(opt => opt.name.toLowerCase() === t.name.toLowerCase());
        if (opt) return { id: opt.id };
        return { name: t.name };
    });
}

function countRelevantWords(tag) {
    return tag.split(/\s+/).filter(w => !stopSet.has(w.toLowerCase())).length;
}

function cleanHeading(heading) {
    let text = heading.replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[^\wÀ-ÿ ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    let words = text.split(/\s+/).filter(word => word.length > 2 && !stopSet.has(word.toLowerCase()));
    if (words.length > 3) words = words.slice(0, 3);
    return words.join(' ');
}

function extractTagsSmart(blocks, maxTags = 5) {
    let contextTag = null;
    const headings = [];

    blocks.forEach(b => {
        if (b.type === 'heading_1') {
            const texto = (b.heading_1?.rich_text || []).map(r => r.plain_text || r.text?.content || '').join(' ');
            if (!contextTag) contextTag = cleanHeading(texto);
            headings.push(texto);
        }
        if (b.type === 'heading_2') {
            const texto = (b.heading_2?.rich_text || []).map(r => r.plain_text || r.text?.content || '').join(' ');
            headings.push(texto);
        }
    });

    let fullText = headings.join(' ');
    blocks.forEach(b => {
        if (b.type === 'paragraph') {
            const texto = (b.paragraph?.rich_text || []).map(r => r.plain_text || r.text?.content || '').join(' ');
            fullText += ' ' + texto;
        }
    });

    const tfidf = new natural.TfIdf();
    tfidf.addDocument(fullText);

    let keywords = [];
    tfidf.listTerms(0).forEach(item => {
        const palavra = item.term.trim().toLowerCase();
        if (palavra.length > 2 && !stopSet.has(palavra) && !palavra.match(/^[0-9]+$/)) {
            keywords.push(palavra);
        }
    });

    let headingTags = headings.map(cleanHeading).filter(t => t.length > 2 && !stopSet.has(t.toLowerCase()));

    let tags = [contextTag, ...headingTags, ...keywords]
        .map(tag => tag && tag.trim())
        .filter(Boolean)
        .map(tag => tag.charAt(0).toUpperCase() + tag.slice(1));

    tags = Array.from(new Set(tags));

    tags = tags.map(t => t.trim()).filter(isTagOk).slice(0, maxTags);
    return tags;
}

module.exports = {
    STOPWORDS,
    EXTRA_STOPWORDS,
    ALL_STOPWORDS,
    isTagOk,
    reconcileTags,
    cleanHeading,
    extractTagsSmart
};
