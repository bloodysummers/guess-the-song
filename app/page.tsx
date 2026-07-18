import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Guess the Song</h1>
      <p>Adivina la canción lo más rápido posible. Juego de fiesta.</p>
      <p>
        <Link href="/host">Crear una sesión (host)</Link> ·{" "}
        <Link href="/play">Unirse a una sesión (jugar)</Link>
      </p>
    </main>
  );
}
