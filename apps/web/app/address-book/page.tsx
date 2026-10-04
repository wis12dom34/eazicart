import { AddressBookContent } from "./address-book-content";

export default async function AddressBookPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkout?: string;
    selectedId?: string;
    editId?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <AddressBookContent
      checkout={params.checkout === "1"}
      selectedId={params.selectedId}
      initialEditId={params.editId}
    />
  );
}
