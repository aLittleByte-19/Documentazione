export interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
  aliases: string[];
}

export interface GlossaryDocument {
  title: string;
  entries: GlossaryEntry[];
}

export interface GlossaryGroup {
  letter: string;
  entries: GlossaryEntry[];
}
