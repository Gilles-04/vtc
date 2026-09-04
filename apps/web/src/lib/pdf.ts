// Les polices standard de jsPDF (WinAnsiEncoding) ne connaissent pas
// l'espace fine insecable (U+202F) ni l'espace insecable (U+00A0)
// qu'Intl.NumberFormat('fr-FR') peut utiliser comme separateur de
// milliers dans fcfa() -- rendu comme un caractere errone dans le PDF
// sinon. Rien a voir avec fcfa() elle-meme, correcte partout ailleurs
// (rendu navigateur) : uniquement un probleme d'encodage propre a jsPDF,
// donc corrige ici plutot que dans format.ts. Partage entre tous les
// generateurs PDF (receipt.ts, invoice.ts).
export function pdfSafe(text: string): string {
  return text.replace(/[  ]/g, ' ')
}
