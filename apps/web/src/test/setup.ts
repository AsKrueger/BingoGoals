// jsdom no crea direcciones para mostrar archivos: cada foto recibe una
// ficticia, distinta para cada una.
let next = 0;
URL.createObjectURL = () => `blob:foto-${++next}`;
URL.revokeObjectURL = () => {};
