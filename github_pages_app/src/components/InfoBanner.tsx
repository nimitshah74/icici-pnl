import { REQUIRED_WORKBOOK_SHEETS } from "../config/outputContract";

export function InfoBanner() {
  return (
    <section className="info-banner">
      <p>
        This browser MVP is being built against the frozen desktop output contract.
        The current slice gives you the full intake flow and content-based statement
        detection, while preserving the workbook target sheet order:
        {" "}
        {REQUIRED_WORKBOOK_SHEETS.join(", ")}.
      </p>
    </section>
  );
}
