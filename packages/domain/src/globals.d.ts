// El dominio no depende ni del navegador ni de Node: solo necesita esta
// función, que existe en los dos.
declare const crypto: {
  randomUUID(): string;
};
