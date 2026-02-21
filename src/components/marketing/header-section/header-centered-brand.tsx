export const HeaderCenteredBrand = () => {
  return (
    <section className="bg-muted/40 py-16 md:py-24">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <span className="text-sm font-semibold text-primary md:text-base">About us</span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">About the company</h1>
          <p className="mt-4 text-base text-muted-foreground md:mt-6 md:text-lg">
            Learn more about the company and the world-class team behind Untitled.
          </p>
        </div>
      </div>
    </section>
  );
};
