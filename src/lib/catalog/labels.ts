export const DEPT_LABEL: Record<string, string> = {
  ENGLISH: "English", SOCIAL_STUDIES: "Social Studies", MATH: "Mathematics", COMPUTER_SCIENCE: "Computer Science",
  SCIENCE: "Science", WORLD_LANGUAGE: "World Language", ART: "Art", BUSINESS: "Business",
  FAMILY_CONSUMER_SCIENCES: "Family and Consumer Sciences", HEALTH_PE: "Health and PE", MUSIC: "Music",
  TECHNOLOGY: "Technology", SPECIAL_ED: "Special Education", OTHER: "Other Programs",
};
export const LEVEL_LABEL: Record<string, string> = {
  CP: "College prep", ENHANCED: "Enhanced", HONORS: "Honors", AP: "AP", MIDDLE_SCHOOL: "Middle school",
};
export const KIND_LABEL: Record<string, string> = {
  ENGLISH: "English", MATH: "Mathematics", SCI_BIO: "Biology", SCI_CHEM: "Chemistry", SCI_PHYS: "Physics",
  SOCIAL_STUDIES: "Social Studies", ARTS: "Visual/Performing Arts", LIFE_CAREERS: "21st Century Life and Careers",
  FIN_LIT: "Financial Literacy", WORLD_LANG: "World Language", PE_HEALTH: "PE and Health",
};
export const fmtCredits = (n: number | string | { toString(): string }) => Number(n.toString()).toString();
