// Vite's ?raw imports, for reading docs in tests.
declare module '*?raw' {
	const text: string;
	export default text;
}
