import type { Metadata } from "next";
import { Book101Landing } from "@/components/book101/Book101Landing";

export const metadata: Metadata = {
  title: "Book101 | Career Tracker for Young Actors",
  description: "Log every audition, callback, avail check, and booking in one private dashboard built for young actors."
};

export default function Book101Page() {
  return <Book101Landing />;
}
