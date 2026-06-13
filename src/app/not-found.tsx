import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <h1>Page not found</h1>
      <p>This actor page is unpublished or does not exist.</p>
      <Link href="/app">Back to Pages101</Link>
    </main>
  );
}
