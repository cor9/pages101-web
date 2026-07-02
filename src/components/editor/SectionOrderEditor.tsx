"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ActorPageSection, SectionType } from "@/lib/types";

const SECTION_LABELS: Record<SectionType, string> = {
  headshots: "Headshots",
  clips: "Slate, Clips & Reels",
  resume: "Resume",
  feed: "Updates Feed",
  press: "Press Quote"
};

function SortableItem({ id, section }: { id: string; section: ActorPageSection }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: "12px 16px",
    margin: "6px 0",
    backgroundColor: "var(--app-surface)",
    border: "1px solid var(--app-line)",
    borderRadius: "var(--radius)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "grab",
    fontWeight: "bold",
    fontSize: "14px",
    color: "var(--app-ink)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <span>{SECTION_LABELS[section.type]}</span>
      <span aria-hidden="true" style={{ color: "var(--app-muted)", fontSize: "16px" }}>☰</span>
    </div>
  );
}

export function SectionOrderEditor({
  sections,
  onChange
}: {
  sections: ActorPageSection[];
  onChange: (sections: ActorPageSection[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      onChange(arrayMove(sections, oldIndex, newIndex));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sections.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {sections.map((section) => (
            <SortableItem key={section.id} id={section.id} section={section} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
