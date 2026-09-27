// Contenu bilingue du site. Tout le texte visible vit ici.
// Le français est la langue par défaut; l'anglais est une version rédigée à part, pas une traduction littérale.

export const services = {
  fr: [
    {
      id: "revision",
      title: "Révision linguistique",
      card: "Grammaire, syntaxe, orthographe, ponctuation, terminologie et cohérence : tout ce qui rend un texte juste, fluide et agréable à lire.",
      summary: "Un texte juste, cohérent et agréable à lire, du premier au dernier paragraphe.",
      body: [
        "La révision linguistique va au-delà de la chasse aux fautes. Elle examine chaque phrase pour s’assurer qu’elle dit exactement ce qu’elle doit dire, dans une langue correcte et naturelle.",
        "Le travail porte autant sur la justesse du vocabulaire que sur l’enchaînement des idées, l’uniformité de la terminologie et le respect du ton choisi. Les modifications sont proposées en mode suivi, accompagnées au besoin de commentaires, afin que vous gardiez le dernier mot."
      ],
      includes: ["Grammaire et syntaxe", "Orthographe et ponctuation", "Choix des mots et terminologie", "Cohérence et uniformité", "Lisibilité et fluidité", "Respect du ton et de la voix"],
      ideal: "Rapports, articles, sites Web, communications internes, mémoires, manuscrits."
    },
    {
      id: "correction",
      title: "Correction d’épreuves",
      card: "La dernière vérification, minutieuse, d’un document avant sa publication, son impression ou sa diffusion.",
      summary: "Le dernier regard attentif avant que votre document ne quitte vos mains.",
      body: [
        "La correction d’épreuves intervient lorsque le texte est pratiquement final. Elle vise à repérer ce qui a pu échapper aux relectures précédentes : coquilles, fautes résiduelles, incohérences typographiques, erreurs de mise en page.",
        "C’est l’étape qui protège votre crédibilité au moment où le document devient public."
      ],
      includes: ["Coquilles et fautes résiduelles", "Typographie et espacements", "Uniformité des titres et listes", "Renvois, numérotation et légendes", "Coupures de mots et veuves", "Vérification sur PDF ou épreuve"],
      ideal: "Brochures, rapports annuels, publications, présentations, documents imprimés."
    },
    {
      id: "redaction",
      title: "Rédaction",
      card: "Des textes professionnels écrits pour leur public, leur objectif et le ton que vous souhaitez donner.",
      summary: "Des textes pensés pour vos lecteurs, écrits avec clarté et précision.",
      body: [
        "Vous savez ce que vous voulez dire, mais le temps ou les mots vous manquent? La rédaction commence par une bonne compréhension de votre sujet, de votre public et de vos objectifs.",
        "À partir de vos notes, de documents de référence ou d’un simple échange, je rédige un texte structuré, clair et adapté à son contexte de diffusion."
      ],
      includes: ["Pages et contenus Web", "Communications d’entreprise", "Articles et billets", "Présentations et documents de fond", "Lettres et courriels importants", "Textes promotionnels sobres"],
      ideal: "Entreprises, organismes, consultants, travailleurs autonomes."
    },
    {
      id: "reecriture",
      title: "Réécriture",
      card: "Transformer un texte existant tout en préservant les idées, l’intention et la voix de son auteur.",
      summary: "Retravailler la forme en profondeur, sans trahir le fond.",
      body: [
        "Certains textes demandent plus qu’une révision : une structure à repenser, des passages à resserrer, un ton à ajuster, un contenu à adapter à un nouveau public.",
        "La réécriture reprend le texte en profondeur tout en respectant ce qui lui appartient : vos idées, votre intention et votre façon de dire les choses."
      ],
      includes: ["Restructuration du propos", "Allègement et concision", "Adaptation du ton ou du registre", "Adaptation à un nouveau public", "Harmonisation de textes à plusieurs auteurs", "Clarification de contenus techniques"],
      ideal: "Textes denses, documents rédigés à plusieurs mains, contenus à actualiser."
    },
    {
      id: "traduction",
      title: "Traduction",
      card: "Une traduction claire et naturelle, fidèle au sens, au ton, au contexte et aux lecteurs visés.",
      summary: "Un texte qui se lit comme s’il avait été écrit directement dans la langue d’arrivée.",
      body: [
        "Une bonne traduction ne se contente pas de transposer des mots. Elle rend le sens, le ton et l’intention du texte d’origine dans une langue naturelle, adaptée à ses lecteurs.",
        "Je traduis de l’anglais vers le français et du français vers l’anglais, en portant une attention particulière à la terminologie et aux usages propres au Québec lorsque c’est pertinent."
      ],
      includes: ["Anglais → français", "Français → anglais", "Adaptation au contexte québécois", "Uniformité terminologique", "Respect du ton et du registre", "Révision complète avant livraison"],
      ideal: "Communications bilingues, sites Web, documents d’entreprise, publications."
    },
    {
      id: "comparative",
      title: "Révision comparative",
      card: "Comparer une traduction à son texte source pour en améliorer l’exactitude, la cohérence et la lisibilité.",
      summary: "Vérifier qu’une traduction dit tout, et le dit bien.",
      body: [
        "La révision comparative, ou révision bilingue, consiste à relire une traduction phrase par phrase en regard de son texte source.",
        "Elle permet de repérer les omissions, les contresens et les calques, d’uniformiser la terminologie et de s’assurer que le texte traduit se lit naturellement."
      ],
      includes: ["Fidélité au texte source", "Omissions et ajouts", "Contresens et faux amis", "Terminologie et cohérence", "Qualité de la langue d’arrivée", "Commentaires explicatifs au besoin"],
      ideal: "Traductions internes, traductions automatiques à valider, documents bilingues."
    }
  ],
  en: [
    {
      id: "editing",
      title: "Linguistic editing",
      card: "Grammar, syntax, spelling, punctuation, terminology and consistency: everything that makes a text accurate, fluent and easy to read.",
      summary: "Accurate, consistent and readable writing, from the first paragraph to the last.",
      body: [
        "Linguistic editing is about more than catching mistakes. It looks at every sentence to make sure it says exactly what it should, in language that is correct and natural.",
        "The work covers word choice, the flow of ideas, consistent terminology and the tone you have chosen. Changes are made with tracked changes and comments where useful, so you always keep the final say."
      ],
      includes: ["Grammar and syntax", "Spelling and punctuation", "Word choice and terminology", "Consistency and style", "Readability and flow", "Respect for tone and voice"],
      ideal: "Reports, articles, websites, internal communications, theses, manuscripts."
    },
    {
      id: "proofreading",
      title: "Proofreading",
      card: "A careful final check of a document before it is published, printed or shared.",
      summary: "The last careful read before your document leaves your hands.",
      body: [
        "Proofreading comes in once a text is essentially final. Its purpose is to catch what earlier reviews may have missed: typos, leftover errors, typographic inconsistencies and layout issues.",
        "It is the step that protects your credibility at the moment your document goes public."
      ],
      includes: ["Typos and remaining errors", "Typography and spacing", "Consistent headings and lists", "Cross-references and numbering", "Hyphenation and line breaks", "Checks on PDF or printed proofs"],
      ideal: "Brochures, annual reports, publications, presentations, print materials."
    },
    {
      id: "writing",
      title: "Writing",
      card: "Professional writing shaped around its audience, its purpose and the tone you want to set.",
      summary: "Writing designed for your readers, with clarity and precision.",
      body: [
        "You know what you want to say, but time or words are in short supply? Writing starts with a clear understanding of your subject, your audience and your goals.",
        "Working from your notes, reference documents or a simple conversation, I write a clear, well-structured text suited to where and how it will be read."
      ],
      includes: ["Web pages and content", "Corporate communications", "Articles and blog posts", "Presentations and background documents", "Important letters and emails", "Understated promotional copy"],
      ideal: "Businesses, organizations, consultants, independent professionals."
    },
    {
      id: "rewriting",
      title: "Rewriting",
      card: "Reshaping an existing text while keeping its author’s ideas, intent and voice.",
      summary: "Reworking the form in depth, without losing the substance.",
      body: [
        "Some texts need more than editing: a structure to rethink, passages to tighten, a tone to adjust, or content to adapt for a new audience.",
        "Rewriting takes the text apart and puts it back together while respecting what belongs to you: your ideas, your intent and your way of saying things."
      ],
      includes: ["Restructuring the argument", "Tightening and concision", "Adjusting tone or register", "Adapting for a new audience", "Harmonizing multi-author texts", "Clarifying technical content"],
      ideal: "Dense texts, documents written by several people, content in need of updating."
    },
    {
      id: "translation",
      title: "Translation",
      card: "Clear, natural translation that respects meaning, tone, context and the intended readers.",
      summary: "A text that reads as if it had been written in the target language.",
      body: [
        "Good translation does more than swap words. It carries the meaning, tone and intent of the original into natural language that suits its readers.",
        "I translate from English into French and from French into English, paying close attention to terminology and, where relevant, to Québec usage."
      ],
      includes: ["English → French", "French → English", "Adaptation for Québec readers", "Consistent terminology", "Respect for tone and register", "Full review before delivery"],
      ideal: "Bilingual communications, websites, corporate documents, publications."
    },
    {
      id: "comparative",
      title: "Comparative revision",
      card: "Reviewing a translation against its source to improve accuracy, consistency and readability.",
      summary: "Making sure a translation says everything, and says it well.",
      body: [
        "Comparative revision, also called bilingual revision, means reading a translation sentence by sentence alongside its source text.",
        "It catches omissions, mistranslations and literal renderings, harmonizes terminology and makes sure the translated text reads naturally."
      ],
      includes: ["Faithfulness to the source", "Omissions and additions", "Mistranslations and false friends", "Terminology and consistency", "Quality of the target language", "Explanatory comments as needed"],
      ideal: "In-house translations, machine translations that need checking, bilingual documents."
    }
  ]
};

export const extraService = {
  fr: {
    id: "accompagnement",
    title: "Accompagnement éditorial",
    summary: "Un regard extérieur et un interlocuteur, à chaque étape de l’écriture.",
    body: [
      "Parfois, le besoin n’entre dans aucune case : un plan à valider, un manuscrit à structurer, un guide de rédaction à établir, une équipe à épauler sur un projet de longue haleine.",
      "L’accompagnement éditorial s’adapte à votre projet, qu’il s’agisse de quelques conseils ponctuels ou d’un suivi régulier."
    ],
    includes: ["Commentaires sur un plan ou une ébauche", "Structuration d’un manuscrit", "Guide de style et lexique maison", "Soutien à la rédaction d’équipe", "Préparation à la publication", "Conseils linguistiques ponctuels"],
    ideal: "Auteurs, chercheurs, équipes de communication, organismes."
  },
  en: {
    id: "support",
    title: "Editorial support",
    summary: "An outside eye and a sounding board, at every stage of writing.",
    body: [
      "Sometimes the need doesn’t fit neatly into a category: an outline to review, a manuscript to structure, a style guide to set up, or a team to support through a long project.",
      "Editorial support adapts to your project, whether you need occasional advice or regular follow-up."
    ],
    includes: ["Feedback on an outline or draft", "Structuring a manuscript", "House style guide and glossary", "Support for team writing", "Preparing for publication", "Occasional language advice"],
    ideal: "Authors, researchers, communications teams, organizations."
  }
};

// Exemple avant/après : '=' commun, '-' retiré, '+' ajouté.
export const beforeAfter = {
  fr: {
    segments: [
      ["-", "Suite à"], ["+", "À la suite de"], ["=", " la réunion "],
      ["-", "qui a eu lieu"], ["+", "de"], ["=", " la semaine dernière, nous "],
      ["-", "voulons vous informer que dans le but d’améliorer nos services, il a été décidé que les heures d’ouverture vont être modifier à partir du mois prochain, ce qui va permettre aux clients qui le désirent de pouvoir nous rejoindre"],
      ["+", "avons décidé de modifier nos heures d’ouverture afin de mieux vous servir. Dès le mois prochain, vous pourrez nous joindre"],
      ["=", " plus facilement, "], ["-", "et ce, "], ["=", "même en soirée."]
    ],
    notes: [
      "« Suite à » remplacé par la locution recommandée « À la suite de »",
      "Infinitif fautif « vont être modifier » éliminé",
      "« Rejoindre » remplacé par « joindre », au sens de « communiquer avec »",
      "Tournure passive « il a été décidé » rendue active",
      "Redondance « permettre… de pouvoir » supprimée",
      "Une seule longue phrase scindée en deux"
    ]
  },
  en: {
    segments: [
      ["=", "Following "], ["-", "up on the meeting that took place last week"], ["+", "last week’s meeting"],
      ["=", ", we "],
      ["-", "want to inform you that in order to improve our services, it has been decided that the opening hours are going to be change starting next month, which will allow customers who wish to be able to"],
      ["+", "have decided to change our opening hours to serve you better. Starting next month, you will be able to"],
      ["=", " reach us more easily, "], ["-", "and this "], ["=", "even in the evening."]
    ],
    notes: [
      "Wordy opening tightened",
      "Grammar error “going to be change” removed",
      "Passive “it has been decided” made active",
      "Redundant “allow… to be able to” removed",
      "Filler “and this” dropped",
      "One long sentence split into two"
    ]
  }
};

export const faq = {
  fr: [
    ["Quels types de documents pouvez-vous réviser?",
      "<p>À peu près tout ce qui s’écrit : rapports, articles, pages Web, infolettres, communications internes, présentations, demandes de subvention, mémoires et thèses, manuscrits, documents de politique ou de procédure, lettres et CV.</p><p>Si vous hésitez, décrivez simplement votre document dans le formulaire; je vous dirai franchement si je suis la bonne personne pour le projet.</p>"],
    ["Travaillez-vous en français et en anglais?",
      "<p>Oui. Je révise et rédige en français et en anglais, et je traduis dans les deux directions. Je peux aussi réviser une traduction en la comparant au texte source.</p>"],
    ["Quelle est la différence entre correction et révision linguistique?",
      "<p>La <strong>correction</strong> vise d’abord les erreurs : orthographe, grammaire, ponctuation, coquilles. On l’effectue souvent en fin de parcours, sur un texte presque final.</p><p>La <strong>révision linguistique</strong> est plus large. En plus de corriger, elle améliore la clarté, la précision du vocabulaire, la structure des phrases, la cohérence et le ton, tout en respectant votre style.</p>"],
    ["Pouvez-vous réécrire un texte existant?",
      "<p>Oui. La réécriture convient lorsqu’un texte doit être restructuré, allégé, adapté à un autre public ou harmonisé après avoir été rédigé à plusieurs mains. Vos idées et votre intention restent au cœur du travail.</p>"],
    ["Comment obtenir une estimation?",
      "<p>Remplissez le formulaire de demande de soumission en joignant, si possible, le document ou un extrait représentatif. Chaque projet est différent : la longueur, le type d’intervention, la complexité du sujet et l’échéance influencent le tarif. Vous recevrez une soumission personnalisée, sans engagement.</p>"],
    ["Quels sont vos délais?",
      "<p>Ils dépendent de la longueur du texte, du travail demandé et de mon horaire au moment de la demande. Indiquez votre échéance dans le formulaire : je vous confirmerai rapidement si elle est réaliste, et nous conviendrons ensemble d’une date de livraison.</p>"],
    ["Pouvez-vous travailler à distance?",
      "<p>Oui. La plupart des projets se déroulent entièrement à distance, par courriel, avec des documents en format Word, Google Docs ou PDF. Un appel téléphonique ou une rencontre virtuelle est toujours possible pour clarifier un projet.</p>"]
  ],
  en: [
    ["What kinds of documents can you edit?",
      "<p>Almost anything written: reports, articles, web pages, newsletters, internal communications, presentations, grant applications, theses and dissertations, manuscripts, policy or procedure documents, letters and résumés.</p><p>If you’re unsure, just describe your document in the form and I’ll tell you honestly whether I’m the right person for the project.</p>"],
    ["Do you work in both French and English?",
      "<p>Yes. I edit and write in French and in English, and translate in both directions. I can also review a translation by comparing it with its source text.</p>"],
    ["What is the difference between proofreading and editing?",
      "<p><strong>Proofreading</strong> focuses on errors: spelling, grammar, punctuation and typos. It usually happens at the end, on a nearly final text.</p><p><strong>Editing</strong> goes further. As well as correcting, it improves clarity, word choice, sentence structure, consistency and tone, while respecting your style.</p>"],
    ["Can you rewrite an existing text?",
      "<p>Yes. Rewriting is the right choice when a text needs to be restructured, tightened, adapted for another audience or harmonized after being written by several people. Your ideas and intent remain at the heart of the work.</p>"],
    ["How do I get a quote?",
      "<p>Fill out the quote request form and, if possible, attach the document or a representative excerpt. Every project is different: length, type of work, subject complexity and deadline all affect the price. You’ll receive a tailored quote with no obligation.</p>"],
    ["What are your turnaround times?",
      "<p>They depend on the length of the text, the work required and my schedule when you get in touch. Let me know your deadline in the form: I’ll quickly confirm whether it’s realistic, and we’ll agree on a delivery date together.</p>"],
    ["Can you work remotely?",
      "<p>Yes. Most projects are handled entirely remotely, by email, using Word, Google Docs or PDF files. A phone call or video meeting is always possible to talk a project through.</p>"]
  ]
};

export const t = {
  fr: {
    locale: "fr_CA",
    brandTag: "Révision linguistique et rédaction",
    skip: "Aller au contenu",
    nav: { home: "Accueil", services: "Services", about: "À propos", method: "Méthode", faq: "FAQ", contact: "Contact" },
    navLabel: "Navigation principale",
    langLabel: "Choisir la langue",
    menu: "Menu",
    ctaQuote: "Demander une soumission",
    ctaDiscuss: "Discuter de votre projet",
    ctaEmail: "Envoyer un courriel",
    ctaEmailShort: "Courriel",
    learnMore: "En savoir plus",
    learnMoreAbout: "sur",
    city: "Montréal, Québec",

    hero: {
      eyebrow: "Réviseur, rédacteur et traducteur · Montréal",
      h1: ["Des textes plus clairs.", "Plus précis.", "Plus <em>percutants.</em>"],
      sub: "Révision linguistique, rédaction et traduction professionnelle à Montréal.",
      text: "J’aide les particuliers, les professionnels, les entreprises et les organismes à rendre leurs communications plus claires, plus justes et plus efficaces, en français comme en anglais, et toujours dans le respect de leur voix.",
      cta2: "Découvrir les services",
      meta: ["Français et anglais", "Travail à distance", "Soumission personnalisée"]
    },
    ms: {
      title: "Note de présentation",
      lines: ["Un bon texte ne se remarque pas :", "il se lit tout simplement. Chaque", "mot y trouve sa place, chaque", "phrase mène à l’essentiel."],
      strike: "tout simplement",
      insert: "avec aisance",
      note: "plus précis?"
    },

    servicesSection: {
      eyebrow: "Services",
      h2: "Des mots à la hauteur de vos idées",
      p: "Qu’il s’agisse de peaufiner un texte, d’en écrire un nouveau ou de le faire passer d’une langue à l’autre, chaque intervention vise la même chose : que votre message soit compris, tel que vous l’entendez.",
      all: "Voir le détail des services"
    },

    value: {
      eyebrow: "Pourquoi la révision",
      h2: "Votre message mérite <em>les bons mots.</em>",
      p: [
        "Une bonne révision ne se limite pas à corriger l’orthographe. Elle clarifie une idée qui se perdait, précise un terme approximatif, allège une phrase trop chargée et rétablit la cohérence d’un document entier.",
        "Le résultat se remarque rarement, et c’est justement le but : le lecteur n’accroche plus sur la forme. Il retient le fond."
      ],
      words: ["Clarté", "Précision", "Crédibilité", "Cohérence", "Lisibilité", "Ton", "Qualité de la langue", "Impact"]
    },

    about: {
      eyebrow: "À propos",
      h2: "À propos de Patrick Foley",
      lede: "Réviseur linguistique, traducteur et rédacteur généraliste établi à Montréal, j’aborde chaque texte avec curiosité, rigueur et respect.",
      p: [
        "Mon travail consiste à aider les gens à exprimer leurs idées avec plus de clarté, de précision et d’impact. Un rapport, un article, une page Web, un manuscrit : chaque document a un lecteur à convaincre, à informer ou à toucher.",
        "Je travaille en français et en anglais, avec des organisations comme avec des particuliers, et je privilégie une collaboration directe : vous savez toujours qui lit votre texte et pourquoi chaque modification est proposée."
      ],
      principlesTitle: "Quatre principes guident mon travail",
      principles: [
        ["Curiosité", "Comprendre le sujet et l’intention derrière chaque texte avant d’y toucher."],
        ["Minutie", "Porter une attention soutenue à la langue, à la structure, à la terminologie et aux détails."],
        ["Respect", "Préserver les intentions de l’auteur et sa voix propre."],
        ["Clarté", "Faciliter la compréhension, sans jamais compliquer inutilement."]
      ],
      portraitAlt: "Portrait de Patrick Foley",
      more: "En savoir plus sur mon approche"
    },

    process: {
      eyebrow: "Méthode",
      h2: "Une collaboration simple",
      p: "Pas de formulaire interminable ni d’intermédiaire : vous échangez directement avec la personne qui travaillera sur votre texte.",
      steps: [
        ["Envoyez votre projet", "Transmettez votre document, une brève description du projet, vos objectifs, votre échéance et toute exigence particulière."],
        ["Analyse", "J’évalue l’ampleur du travail et le type d’intervention nécessaire, puis je vous fais parvenir une soumission claire."],
        ["Révision, rédaction ou traduction", "Le travail est réalisé avec soin, en tenant compte du contexte, du public visé, de la terminologie et de votre voix."],
        ["Livraison", "Vous recevez le document peaufiné, et nous pouvons discuter ensemble des dernières questions."]
      ],
      aside: "Un texte à améliorer, une idée à mettre en mots?",
      cta: "Parlez-moi de votre projet"
    },

    audience: {
      eyebrow: "Pour qui",
      h2: "Pour les organisations comme pour les particuliers",
      p: "Que vous prépariez les communications d’une organisation ou un document personnel important, le même soin s’applique.",
      who: ["PME, entrepreneurs et travailleurs autonomes", "Consultants et professionnels", "Organismes à but non lucratif", "Équipes de communication et de marketing", "Auteurs, chercheurs, étudiants et universitaires", "Particuliers qui préparent un document important"],
      examplesLabel: "Quelques exemples de projets",
      examples: ["Communications d’entreprise", "Documents professionnels", "Articles", "Rapports", "Publications", "Communications numériques", "Documents universitaires", "Manuscrits", "Présentations", "Contenu marketing", "Sites Web", "Documents personnels et professionnels"],
      note: "Ces exemples illustrent les types de projets possibles; ils ne constituent pas une liste de mandats réalisés."
    },

    ba: {
      eyebrow: "Démonstration",
      h2: "Quelques mots peuvent tout changer.",
      p: "Voici un court paragraphe typique d’une communication d’entreprise, avant et après révision.",
      label: "Exemple fictif à titre illustratif, et non un projet client.",
      toggle: "Afficher les modifications",
      before: "Avant",
      after: "Après",
      words: "mots",
      legendDel: "Texte retiré",
      legendIns: "Texte ajouté",
      notesTitle: "Ce qui a changé"
    },

    faq: { eyebrow: "FAQ", h2: "Questions fréquentes", p: "Vous ne trouvez pas la réponse à votre question?", link: "Écrivez-moi" },

    contact: {
      eyebrow: "Contact",
      h2: "Vous avez un texte à améliorer? <em>Parlons-en.</em>",
      p: "Qu’il s’agisse de réviser, de corriger, de traduire, de réécrire ou de créer un document de toutes pièces, expliquez-moi simplement ce dont vous avez besoin. Je vous répondrai avec une soumission adaptée à votre projet.",
      email: "Courriel",
      phone: "Téléphone",
      formTitle: "Demande de soumission",
      formIntro: "Les champs marqués d’un astérisque (*) sont obligatoires.",
      f: {
        name: "Nom", email: "Courriel", org: "Organisation", optional: "(facultatif)",
        service: "Type de service", servicePh: "Choisissez un service",
        serviceOpts: ["Révision linguistique", "Correction d’épreuves", "Rédaction", "Réécriture", "Traduction", "Révision comparative", "Accompagnement éditorial", "Je ne sais pas encore"],
        lang: "Langue", langPh: "Choisissez la langue",
        langOpts: ["Français", "Anglais", "Français et anglais", "Traduction de l’anglais vers le français", "Traduction du français vers l’anglais"],
        desc: "Description du projet", descHint: "Type de document, longueur approximative, public visé, objectif.",
        deadline: "Échéance souhaitée",
        file: "Document", fileBtn: "Joindre un fichier", fileNone: "Aucun fichier sélectionné", fileHint: "PDF, Word, ODT, RTF, TXT, PowerPoint ou Excel · 10 Mo maximum. Un extrait représentatif suffit.", fileClear: "Retirer",
        message: "Message", messageHint: "Précisions, questions ou contexte supplémentaire.",
        consent: "J’accepte que les renseignements transmis soient utilisés uniquement pour répondre à ma demande, conformément à la",
        privacy: "politique de confidentialité",
        hp: "Ne pas remplir ce champ",
        submit: "Envoyer ma demande",
        reassure: "Votre demande n’engage à rien. Je réponds personnellement à chaque message."
      },
      success: {
        h: "Merci, votre demande est bien partie.",
        p: "Je prendrai connaissance de votre projet et vous répondrai personnellement par courriel dans les meilleurs délais. Si votre demande est urgente, n’hésitez pas à m’appeler.",
        again: "Retour à l’accueil"
      }
    },

    footer: {
      services: "Révision | Rédaction | Traduction",
      nav: "Navigation",
      contact: "Coordonnées",
      privacy: "Politique de confidentialité",
      rights: "Tous droits réservés."
    },

    pages: {
      home: {
        title: "Réviseur linguistique à Montréal | Patrick Foley – Révision et rédaction",
        desc: "Révision linguistique, correction, rédaction, réécriture et traduction professionnelle à Montréal. Des textes plus clairs, plus précis et plus percutants, en français et en anglais."
      },
      services: {
        title: "Services de révision, rédaction et traduction à Montréal | Patrick Foley",
        desc: "Révision linguistique, correction d’épreuves, rédaction professionnelle, réécriture, traduction et révision comparative à Montréal, en français et en anglais.",
        h1: "Des services pensés pour vos textes",
        lede: "Chaque texte a ses besoins. Voici comment je peux intervenir, de la simple relecture finale à la rédaction complète, en français comme en anglais.",
        forWho: "Idéal pour",
        includes: "Ce que comprend le service",
        tocLabel: "Aller à un service",
        bandH: "Vous ne savez pas quel service choisir?",
        bandP: "Décrivez votre projet : je vous proposerai l’intervention la plus appropriée."
      },
      about: {
        title: "À propos de Patrick Foley | Réviseur et rédacteur à Montréal",
        desc: "Patrick Foley est réviseur linguistique, traducteur et rédacteur à Montréal. Une approche fondée sur la curiosité, la minutie, le respect de votre voix et la clarté.",
        h1: "Un regard attentif sur chacun de vos mots",
        lede: "Réviseur linguistique, traducteur et rédacteur généraliste à Montréal.",
        quote: "Un texte réussi, c’est un texte où <em>le lecteur n’accroche jamais sur la forme</em> et peut se concentrer entièrement sur le propos.",
        sections: [
          ["Une approche personnelle", "Travailler avec un professionnel indépendant, c’est savoir exactement qui lit votre texte. Je m’intéresse à votre sujet, à vos lecteurs et à ce que vous voulez accomplir avant de proposer la moindre modification. Chaque intervention a une raison d’être, et je suis toujours disposé à l’expliquer."],
          ["Deux langues, un même souci du détail", "Je travaille en français et en anglais : révision, rédaction et traduction dans les deux directions. Cette double pratique est particulièrement utile pour les organisations montréalaises et québécoises qui communiquent avec des publics variés, et pour qui la qualité des deux versions compte autant."],
          ["Un généraliste curieux", "Rapports d’organismes, contenus Web, textes universitaires, communications d’entreprise, manuscrits : j’aime passer d’un univers à l’autre. Cette polyvalence s’accompagne d’une règle simple : prendre le temps de comprendre le contexte et la terminologie propres à chaque domaine."]
        ]
      },
      contact: {
        title: "Demander une soumission | Patrick Foley – Révision linguistique Montréal",
        desc: "Demandez une soumission pour la révision, la correction, la rédaction, la réécriture ou la traduction de votre texte. Réponse personnalisée, sans engagement.",
        h1: "Parlons de votre projet",
        lede: "Décrivez votre texte et vos besoins : vous recevrez une soumission personnalisée, sans engagement."
      },
      privacy: {
        title: "Politique de confidentialité | Patrick Foley",
        desc: "Comment Patrick Foley recueille, utilise et protège les renseignements personnels transmis par l’entremise du site Web.",
        h1: "Politique de confidentialité"
      },
      thanks: {
        title: "Merci | Patrick Foley",
        desc: "Votre demande a bien été reçue.",
        h1: "Merci, votre demande est bien partie."
      }
    },
    notFoundBack: "Retour à l’accueil",
    breadcrumbHome: "Accueil"
  },

  en: {
    locale: "en_CA",
    brandTag: "Editing and writing",
    skip: "Skip to content",
    nav: { home: "Home", services: "Services", about: "About", method: "Process", faq: "FAQ", contact: "Contact" },
    navLabel: "Main navigation",
    langLabel: "Choose language",
    menu: "Menu",
    ctaQuote: "Request a quote",
    ctaDiscuss: "Discuss your project",
    ctaEmail: "Send an email",
    ctaEmailShort: "Email",
    learnMore: "Learn more",
    learnMoreAbout: "about",
    city: "Montréal, Québec",

    hero: {
      eyebrow: "Editor, writer and translator · Montréal",
      h1: ["Clearer writing.", "More precise.", "More <em>compelling.</em>"],
      sub: "Professional editing, writing and translation in Montréal.",
      text: "I help individuals, professionals, businesses and organizations make their communications clearer, more accurate and more effective, in English and in French, always in their own voice.",
      cta2: "Explore services",
      meta: ["English and French", "Remote-friendly", "Tailored quotes"]
    },
    ms: {
      title: "Briefing note",
      lines: ["Good writing goes unnoticed:", "it simply reads well. Every", "word has its place, every", "sentence leads to the point."],
      strike: "simply reads well",
      insert: "reads with ease",
      note: "more precise?"
    },

    servicesSection: {
      eyebrow: "Services",
      h2: "Words that live up to your ideas",
      p: "Whether a text needs polishing, writing from scratch or carrying from one language to another, the goal is always the same: your message understood the way you mean it.",
      all: "See all services in detail"
    },

    value: {
      eyebrow: "Why editing matters",
      h2: "Your message deserves <em>the right words.</em>",
      p: [
        "Good editing goes well beyond fixing spelling. It clarifies an idea that was getting lost, sharpens a vague term, lightens an overloaded sentence and restores consistency across an entire document.",
        "The result is rarely noticed, and that is the point: readers no longer stumble over the form. They remember the substance."
      ],
      words: ["Clarity", "Precision", "Credibility", "Consistency", "Readability", "Tone", "Language quality", "Impact"]
    },

    about: {
      eyebrow: "About",
      h2: "About Patrick Foley",
      lede: "A Montréal-based linguistic editor, translator and generalist writer, I approach every text with curiosity, rigour and respect.",
      p: [
        "My work is about helping people express their ideas with greater clarity, precision and impact. A report, an article, a web page, a manuscript: every document has a reader to persuade, inform or move.",
        "I work in English and in French, with organizations and individuals alike, and I value working directly with clients: you always know who is reading your text and why each change is suggested."
      ],
      principlesTitle: "Four principles guide my work",
      principles: [
        ["Curiosity", "Understanding the subject and the purpose behind every text before touching it."],
        ["Care", "Paying close attention to language, structure, terminology and detail."],
        ["Respect", "Preserving the writer’s intentions and individual voice."],
        ["Clarity", "Making ideas easier to understand, never more complicated than they need to be."]
      ],
      portraitAlt: "Portrait of Patrick Foley",
      more: "More about my approach"
    },

    process: {
      eyebrow: "Process",
      h2: "A straightforward collaboration",
      p: "No endless forms and no middlemen: you deal directly with the person who will work on your text.",
      steps: [
        ["Send your project", "Share your document along with a short description, your goals, your deadline and any specific requirements."],
        ["Review", "I assess the scope and the type of work required, then send you a clear quote."],
        ["Editing, writing or translation", "The work is done carefully, with attention to context, audience, terminology and your voice."],
        ["Delivery", "You receive the polished document, and we can go over any final questions together."]
      ],
      aside: "A text to improve, or an idea to put into words?",
      cta: "Tell me about your project"
    },

    audience: {
      eyebrow: "Who it’s for",
      h2: "For organizations and individuals alike",
      p: "Whether you are preparing an organization’s communications or an important personal document, the same care applies.",
      who: ["Small and medium-sized businesses, entrepreneurs, freelancers", "Consultants and professionals", "Nonprofit organizations", "Communications and marketing teams", "Authors, researchers, students and academics", "Individuals preparing an important document"],
      examplesLabel: "Examples of projects",
      examples: ["Corporate communications", "Professional documents", "Articles", "Reports", "Publications", "Digital communications", "Academic papers", "Manuscripts", "Presentations", "Marketing content", "Websites", "Personal and career documents"],
      note: "These examples illustrate the kinds of projects possible; they are not a list of past assignments."
    },

    ba: {
      eyebrow: "Example",
      h2: "A few words can change everything.",
      p: "Here is a short paragraph typical of business communications, before and after editing.",
      label: "Fictional example for illustration only, not a client project.",
      toggle: "Show changes",
      before: "Before",
      after: "After",
      words: "words",
      legendDel: "Removed",
      legendIns: "Added",
      notesTitle: "What changed"
    },

    faq: { eyebrow: "FAQ", h2: "Frequently asked questions", p: "Can’t find the answer you’re looking for?", link: "Write to me" },

    contact: {
      eyebrow: "Contact",
      h2: "Have a text that could be better? <em>Let’s talk.</em>",
      p: "Whether you need something revised, proofread, translated, rewritten or written from scratch, simply tell me what you need. I’ll get back to you with a quote tailored to your project.",
      email: "Email",
      phone: "Phone",
      formTitle: "Quote request",
      formIntro: "Fields marked with an asterisk (*) are required.",
      f: {
        name: "Name", email: "Email", org: "Organization", optional: "(optional)",
        service: "Type of service", servicePh: "Choose a service",
        serviceOpts: ["Linguistic editing", "Proofreading", "Writing", "Rewriting", "Translation", "Comparative revision", "Editorial support", "Not sure yet"],
        lang: "Language", langPh: "Choose a language",
        langOpts: ["English", "French", "English and French", "Translation from French into English", "Translation from English into French"],
        desc: "Project description", descHint: "Type of document, approximate length, intended audience, purpose.",
        deadline: "Preferred deadline",
        file: "Document", fileBtn: "Attach a file", fileNone: "No file selected", fileHint: "PDF, Word, ODT, RTF, TXT, PowerPoint or Excel · 10 MB max. A representative excerpt is enough.", fileClear: "Remove",
        message: "Message", messageHint: "Details, questions or additional context.",
        consent: "I agree that the information I provide will be used solely to respond to my request, in accordance with the",
        privacy: "privacy policy",
        hp: "Leave this field empty",
        submit: "Send my request",
        reassure: "No obligation. I personally reply to every message."
      },
      success: {
        h: "Thank you, your request is on its way.",
        p: "I’ll review your project and get back to you personally by email as soon as possible. If your request is urgent, feel free to call.",
        again: "Back to home"
      }
    },

    footer: {
      services: "Editing | Writing | Translation",
      nav: "Navigation",
      contact: "Contact",
      privacy: "Privacy policy",
      rights: "All rights reserved."
    },

    pages: {
      home: {
        title: "Professional Editor in Montreal | Patrick Foley – Editing & Writing",
        desc: "Professional editing, proofreading, copyediting, writing and French–English translation in Montreal. Clearer, more precise and more compelling writing."
      },
      services: {
        title: "Editing, Writing & Translation Services in Montreal | Patrick Foley",
        desc: "Copyediting, proofreading, professional writing, rewriting, French–English translation and comparative revision in Montreal, Quebec.",
        h1: "Services built around your writing",
        lede: "Every text has its own needs. Here is how I can help, from a final proofread to writing from scratch, in English and in French.",
        forWho: "Ideal for",
        includes: "What’s included",
        tocLabel: "Jump to a service",
        bandH: "Not sure which service you need?",
        bandP: "Describe your project and I’ll suggest the most suitable approach."
      },
      about: {
        title: "About Patrick Foley | Editor and Writer in Montreal",
        desc: "Patrick Foley is a Montreal-based linguistic editor, translator and writer. An approach grounded in curiosity, care, respect for your voice and clarity.",
        h1: "A careful eye on every word",
        lede: "Linguistic editor, translator and generalist writer based in Montréal.",
        quote: "Successful writing is writing where <em>the reader never stumbles over the form</em> and can focus entirely on what is being said.",
        sections: [
          ["A personal approach", "Working with an independent professional means knowing exactly who is reading your text. I take an interest in your subject, your readers and what you want to achieve before suggesting a single change. Every edit has a reason, and I’m always happy to explain it."],
          ["Two languages, the same attention to detail", "I work in English and in French: editing, writing and translation in both directions. This is especially useful for Montréal and Québec organizations that speak to varied audiences, and for whom the quality of both versions matters equally."],
          ["A curious generalist", "Nonprofit reports, web content, academic writing, corporate communications, manuscripts: I enjoy moving between worlds. That versatility comes with one simple rule: taking the time to understand each field’s context and terminology."]
        ]
      },
      contact: {
        title: "Request a Quote | Patrick Foley – Editing Services Montreal",
        desc: "Request a quote for editing, proofreading, writing, rewriting or translation. A personal, no-obligation reply from a Montreal editor.",
        h1: "Let’s talk about your project",
        lede: "Describe your text and what you need: you’ll receive a tailored, no-obligation quote."
      },
      privacy: {
        title: "Privacy Policy | Patrick Foley",
        desc: "How Patrick Foley collects, uses and protects personal information submitted through this website.",
        h1: "Privacy policy"
      },
      thanks: {
        title: "Thank you | Patrick Foley",
        desc: "Your request has been received.",
        h1: "Thank you, your request is on its way."
      }
    },
    notFoundBack: "Back to home",
    breadcrumbHome: "Home"
  }
};

export const privacy = {
  fr: `
<p><em>Dernière mise à jour : {{DATE}}</em></p>
<p>La protection de vos renseignements personnels est importante. La présente politique explique quels renseignements sont recueillis par l’entremise de ce site, pourquoi et comment ils sont protégés, conformément à la Loi sur la protection des renseignements personnels dans le secteur privé du Québec.</p>
<h2>Renseignements recueillis</h2>
<p>Lorsque vous remplissez le formulaire de demande de soumission, les renseignements suivants peuvent être recueillis : votre nom, votre adresse courriel, le nom de votre organisation (facultatif), la nature de votre projet, l’échéance souhaitée, votre message et, le cas échéant, le document joint.</p>
<p>Ce site n’utilise aucun témoin (cookie) publicitaire ni outil de suivi tiers.</p>
<h2>Utilisation</h2>
<p>Ces renseignements servent uniquement à répondre à votre demande, à préparer une soumission et, si vous confiez un mandat, à réaliser le travail. Ils ne sont jamais vendus, loués ni communiqués à des tiers à des fins commerciales.</p>
<h2>Confidentialité des documents</h2>
<p>Les documents transmis sont traités de façon confidentielle et ne sont utilisés que dans le cadre de votre projet.</p>
<h2>Conservation</h2>
<p>Les renseignements sont conservés le temps nécessaire au traitement de votre demande et à la réalisation du mandat, puis supprimés de façon sécuritaire, sauf obligation légale contraire.</p>
<h2>Vos droits</h2>
<p>Vous pouvez en tout temps demander l’accès à vos renseignements personnels, leur rectification ou leur suppression, ou retirer votre consentement, en écrivant à <a href="mailto:{{EMAIL}}">{{EMAIL}}</a>.</p>
<h2>Responsable de la protection des renseignements personnels</h2>
<p>Patrick Foley, <a href="mailto:{{EMAIL}}">{{EMAIL}}</a>.</p>`,
  en: `
<p><em>Last updated: {{DATE}}</em></p>
<p>Protecting your personal information matters. This policy explains what information is collected through this website, why, and how it is protected, in accordance with Québec’s Act respecting the protection of personal information in the private sector.</p>
<h2>Information collected</h2>
<p>When you fill out the quote request form, the following information may be collected: your name, email address, organization name (optional), the nature of your project, your preferred deadline, your message and, where applicable, the attached document.</p>
<p>This website uses no advertising cookies or third-party tracking tools.</p>
<h2>Use</h2>
<p>This information is used solely to respond to your request, prepare a quote and, if you go ahead with a project, carry out the work. It is never sold, rented or shared with third parties for commercial purposes.</p>
<h2>Confidentiality of documents</h2>
<p>Documents you send are handled confidentially and used only for your project.</p>
<h2>Retention</h2>
<p>Information is kept for as long as needed to handle your request and complete the project, then securely deleted, unless the law requires otherwise.</p>
<h2>Your rights</h2>
<p>You may at any time request access to, correction of or deletion of your personal information, or withdraw your consent, by writing to <a href="mailto:{{EMAIL}}">{{EMAIL}}</a>.</p>
<h2>Person in charge of personal information</h2>
<p>Patrick Foley, <a href="mailto:{{EMAIL}}">{{EMAIL}}</a>.</p>`
};
