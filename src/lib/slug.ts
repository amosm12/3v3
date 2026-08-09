import { customAlphabet } from "nanoid";

// Unambiguous lowercase alphanumeric alphabet (no 0/o/1/l/i confusion) so a
// slug read aloud or typed by hand tomorrow is less error-prone.
const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";

export const generateSlug = customAlphabet(alphabet, 12);
