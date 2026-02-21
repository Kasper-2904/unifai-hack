"""Stripe service for handling payments and seller onboarding."""

import stripe
from typing import Optional
from src.config import get_settings


class StripeService:
    def __init__(self):
        self.settings = get_settings()
        stripe.api_key = self.settings.stripe_secret_key

    # ============== Products & Prices ==============

    def create_product_and_price(
        self,
        name: str,
        description: str,
        price_cents: int,
        seller_stripe_account_id: Optional[str] = None,
    ) -> tuple[str, str]:
        """
        Create a Stripe Product and Price for a marketplace agent.

        Args:
            name: Product name
            description: Product description
            price_cents: Price in cents (e.g., 500 = $5.00)
            seller_stripe_account_id: Seller's Connect account (for transfers)

        Returns:
            Tuple of (product_id, price_id)
        """
        try:
            # Create the product
            product = stripe.Product.create(
                name=name,
                description=description,
                metadata={
                    "seller_stripe_account_id": seller_stripe_account_id or "",
                },
            )

            # Create the price (one-time payment for usage-based)
            price = stripe.Price.create(
                product=product.id,
                unit_amount=price_cents,
                currency="usd",
            )

            return product.id, price.id
        except stripe.error.StripeError as e:
            print(f"Stripe error creating product: {e}")
            raise

    # ============== Checkout Sessions ==============

    def create_checkout_session(
        self,
        team_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        mode: str = "subscription",
    ) -> str:
        """Create a Stripe checkout session for a team subscription."""
        try:
            session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=[
                    {
                        "price": price_id,
                        "quantity": 1,
                    }
                ],
                mode=mode,
                success_url=success_url,
                cancel_url=cancel_url,
                client_reference_id=team_id,
            )
            return session.url
        except stripe.error.StripeError as e:
            print(f"Stripe error: {e}")
            raise

    def create_marketplace_checkout_session(
        self,
        team_id: str,
        marketplace_agent_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        seller_stripe_account_id: Optional[str] = None,
    ) -> str:
        """
        Create a checkout session for purchasing a marketplace agent.

        If seller has a Connect account, applies platform fee and transfers to seller.
        """
        try:
            session_params = {
                "payment_method_types": ["card"],
                "line_items": [
                    {
                        "price": price_id,
                        "quantity": 1,
                    }
                ],
                "mode": "payment",  # One-time payment for agent access
                "success_url": f"{success_url}?session_id={{CHECKOUT_SESSION_ID}}",
                "cancel_url": cancel_url,
                "client_reference_id": team_id,
                "metadata": {
                    "team_id": team_id,
                    "marketplace_agent_id": marketplace_agent_id,
                    "type": "marketplace_agent_purchase",
                },
            }

            # If seller has Connect account, add platform fee
            if seller_stripe_account_id:
                # Platform takes commission (configured in settings)
                commission_rate = self.settings.platform_commission_rate
                session_params["payment_intent_data"] = {
                    "application_fee_amount": None,  # Will be calculated on webhook
                    "transfer_data": {
                        "destination": seller_stripe_account_id,
                    },
                }

            session = stripe.checkout.Session.create(**session_params)
            return session.url
        except stripe.error.StripeError as e:
            print(f"Stripe error: {e}")
            raise

    # ============== Connect (Seller Onboarding) ==============

    def create_connect_account(self, user_id: str, email: str) -> str:
        """Create a Stripe Connect Express account for a seller."""
        try:
            account = stripe.Account.create(
                type="express",
                email=email,
                capabilities={
                    "card_payments": {"requested": True},
                    "transfers": {"requested": True},
                },
                metadata={"user_id": user_id},
            )
            return account.id
        except stripe.error.StripeError as e:
            print(f"Stripe error: {e}")
            raise

    def create_account_link(self, account_id: str, refresh_url: str, return_url: str) -> str:
        """Create an account link for Stripe Connect onboarding."""
        try:
            account_link = stripe.AccountLink.create(
                account=account_id,
                refresh_url=refresh_url,
                return_url=return_url,
                type="account_onboarding",
            )
            return account_link.url
        except stripe.error.StripeError as e:
            print(f"Stripe error: {e}")
            raise

    def get_account_status(self, account_id: str) -> dict:
        """Get the status of a Connect account."""
        try:
            account = stripe.Account.retrieve(account_id)
            return {
                "id": account.id,
                "charges_enabled": account.charges_enabled,
                "payouts_enabled": account.payouts_enabled,
                "details_submitted": account.details_submitted,
            }
        except stripe.error.StripeError as e:
            print(f"Stripe error: {e}")
            raise

    # ============== Webhooks ==============

    def construct_webhook_event(self, payload: bytes, signature: str) -> stripe.Event:
        """Construct and verify a Stripe webhook event."""
        try:
            event = stripe.Webhook.construct_event(
                payload,
                signature,
                self.settings.stripe_webhook_secret,
            )
            return event
        except stripe.error.SignatureVerificationError as e:
            print(f"Webhook signature verification failed: {e}")
            raise
        except Exception as e:
            print(f"Webhook error: {e}")
            raise

    def retrieve_checkout_session(self, session_id: str) -> stripe.checkout.Session:
        """Retrieve a checkout session by ID."""
        return stripe.checkout.Session.retrieve(session_id)


_stripe_service: StripeService | None = None


def get_stripe_service() -> StripeService:
    """Get singleton Stripe service."""
    global _stripe_service
    if _stripe_service is None:
        _stripe_service = StripeService()
    return _stripe_service
