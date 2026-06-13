import { accentSwatches, fontPairOptions, templateTokens } from "@/lib/templates";
import { samplePages } from "@/lib/sample-data";
import { tips } from "@/content/tips";
import { validateSlug } from "@/lib/slug";

const page = samplePages[0];
const checkedSlug = validateSlug(page.slug);

export function DashboardShell() {
  return (
    <main className="dashboard-shell">
      <section className="dashboard-header">
        <div>
          <p>Pages101 Editor</p>
          <h1>Build a casting-ready actor page in one sitting.</h1>
        </div>
        <a href={`/p/${page.slug}`}>Preview public page</a>
      </section>

      <section className="editor-grid">
        <article className="editor-panel">
          <div className="panel-heading">
            <p>Page Setup</p>
            <span>{checkedSlug.ok ? "URL approved" : checkedSlug.reason}</span>
          </div>
          <label>
            Performer name
            <input defaultValue={page.displayName} />
          </label>
          <label>
            Safe URL
            <input defaultValue={page.slug} />
          </label>
          <label>
            Status line
            <input defaultValue={page.statusLine} />
          </label>
          <div className="three-fields">
            <label>
              Union
              <input defaultValue={page.unionStatus} />
            </label>
            <label>
              Age range
              <input defaultValue={page.ageRange} />
            </label>
            <label>
              Market
              <input defaultValue={page.market} />
            </label>
          </div>
        </article>

        <article className="editor-panel">
          <div className="panel-heading">
            <p>Template</p>
            <span>Free pages publish Classic</span>
          </div>
          <div className="template-options">
            {Object.values(templateTokens).map((template) => (
              <button key={template.id} type="button" aria-pressed={template.id === page.template}>
                <strong>{template.label}</strong>
                <span>{template.tier === "plus" ? "Plus" : "Free"}</span>
              </button>
            ))}
          </div>
          <div className="swatches" aria-label="Accent color">
            {accentSwatches.map((swatch) => (
              <button key={swatch.label} type="button" style={{ "--swatch": swatch.value ?? "#c9282d" } as React.CSSProperties}>
                {swatch.label}
              </button>
            ))}
          </div>
          <label>
            Font pairing
            <select defaultValue="template">
              {fontPairOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </article>

        <article className="editor-panel section-sorter">
          <div className="panel-heading">
            <p>Sections</p>
            <span>Reorder and publish</span>
          </div>
          {page.sections
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((section) => (
              <div key={section.id} className="section-row">
                <button type="button" aria-label={`Drag ${section.type}`}>
                  ::
                </button>
                <span>{section.type}</span>
                <label>
                  <input type="checkbox" defaultChecked={section.enabled} />
                  Enabled
                </label>
              </div>
            ))}
        </article>

        <article className="editor-panel tips-panel">
          <div className="panel-heading">
            <p>101 Tips</p>
            <span>Corey&apos;s voice</span>
          </div>
          {Object.values(tips).map((tip) => (
            <div key={tip.title}>
              <strong>{tip.title}</strong>
              <p>{tip.body}</p>
            </div>
          ))}
        </article>
      </section>
    </main>
  );
}
