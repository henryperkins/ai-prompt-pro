import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/base/buttons/button";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Form } from "@/components/base/form/form";
import { Input, InputBase } from "@/components/base/input/input";
import { InputGroup } from "@/components/base/input/input-group";
import { NativeSelect } from "@/components/base/select/select-native";
import { TextArea } from "@/components/base/textarea/textarea";
import { useToast } from "@/hooks/use-toast";
import { submitContactMessage } from "@/lib/contact-support";
import countries, { phoneCodeOptions } from "@/lib/utils/countries";

export const ContactSimpleForm = () => {
    const [selectedCountryPhone, setSelectedCountryPhone] = useState("US");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isSubmitting) return;

        const form = event.currentTarget;
        const formData = new FormData(form);
        const firstName = String(formData.get("firstName") || "");
        const lastName = String(formData.get("lastName") || "");
        const email = String(formData.get("email") || "");
        const phoneCountry = String(formData.get("phoneCountry") || selectedCountryPhone || "US");
        const phoneNumber = String(formData.get("phone") || "");
        const message = String(formData.get("message") || "");
        const privacyConsent = formData.get("privacy") !== null;

        setIsSubmitting(true);
        try {
            await submitContactMessage({
                firstName,
                lastName,
                email,
                phoneCountry,
                phoneNumber,
                message,
                privacyConsent,
            });
            toast({
                title: "Message sent",
                description: "Thanks for reaching out. Support will follow up soon.",
            });
            form.reset();
            setSelectedCountryPhone("US");
        } catch (error) {
            toast({
                title: "Could not send message",
                description: error instanceof Error ? error.message : "Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="bg-muted/40 py-16 md:py-24">
            <div className="mx-auto w-full max-w-5xl px-4 md:px-8">
                <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
                    <span className="text-sm font-semibold text-primary md:text-base">Contact us</span>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">Get in touch</h2>
                    <p className="mt-4 text-base text-muted-foreground md:mt-6 md:text-lg">We'd love to hear from you. Please fill out this form.</p>
                </div>

                <Form
                    onSubmit={(event) => void handleSubmit(event)}
                    aria-busy={isSubmitting}
                    className="mx-auto mt-12 flex w-full max-w-2xl flex-col gap-8 md:mt-16"
                >
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-x-8 gap-y-6 md:flex-row">
                            <Input isRequired size="md" name="firstName" label="First name" placeholder="First name" wrapperClassName="flex-1" maxLength={80} />
                            <Input isRequired size="md" name="lastName" label="Last name" placeholder="Last name" wrapperClassName="flex-1" maxLength={80} />
                        </div>
                        <Input isRequired size="md" name="email" label="Email" type="email" placeholder="you@company.com" maxLength={320} />
                        <InputGroup
                            size="md"
                            name="phone"
                            label="Phone number"
                            leadingAddon={
                                <NativeSelect
                                    aria-label="Country code"
                                    name="phoneCountry"
                                    value={selectedCountryPhone}
                                    onChange={(value) => setSelectedCountryPhone(value.currentTarget.value)}
                                    options={phoneCodeOptions.map((item) => ({
                                        label: item.label as string,
                                        value: item.id as string,
                                    }))}
                                />
                            }
                        >
                            <InputBase
                                name="phone"
                                type="tel"
                                placeholder={countries.find((country) => country.code === selectedCountryPhone)?.phoneMask?.replace(/#/g, "0")}
                                maxLength={50}
                            />
                        </InputGroup>
                        <TextArea isRequired name="message" label="Message" placeholder="Leave us a message..." rows={5} maxLength={5000} />
                        <Checkbox
                            name="privacy"
                            size="md"
                            label="I agree to the privacy policy."
                            hint={
                                <>
                                    We only use this information to respond to your request. Review our{" "}
                                    <Link
                                        to="/privacy"
                                        className="rounded-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        privacy policy
                                    </Link>
                                    .
                                </>
                            }
                        />
                    </div>

                    <Button type="submit" size="xl" isDisabled={isSubmitting} isLoading={isSubmitting}>
                        {isSubmitting ? "Sending..." : "Send message"}
                    </Button>
                </Form>
            </div>
        </section>
    );
};
