"""Tests for Stripe service."""

import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4

import stripe

from src.services.stripe_service import StripeService, get_stripe_service


# ============== Fixtures ==============


@pytest.fixture
def stripe_service():
    """Create a StripeService instance with mocked settings."""
    with patch("src.services.stripe_service.get_settings") as mock_settings:
        mock_settings.return_value = MagicMock(
            stripe_secret_key="sk_test_123",
            stripe_webhook_secret="whsec_test_123",
            platform_commission_rate=0.20,
        )
        service = StripeService()
        return service


# ============== Product & Price Tests ==============


class TestCreateProductAndPrice:
    """Tests for creating Stripe products and prices."""

    def test_create_product_and_price_success(self, stripe_service):
        """Test successful product and price creation."""
        mock_product = MagicMock(id="prod_test123")
        mock_price = MagicMock(id="price_test123")

        with patch.object(stripe.Product, "create", return_value=mock_product):
            with patch.object(stripe.Price, "create", return_value=mock_price):
                product_id, price_id = stripe_service.create_product_and_price(
                    name="Test Agent",
                    description="A test agent",
                    price_cents=500,
                    seller_stripe_account_id="acct_seller123",
                )

        assert product_id == "prod_test123"
        assert price_id == "price_test123"

    def test_create_product_and_price_without_seller(self, stripe_service):
        """Test product creation without seller Connect account."""
        mock_product = MagicMock(id="prod_test456")
        mock_price = MagicMock(id="price_test456")

        with patch.object(
            stripe.Product, "create", return_value=mock_product
        ) as mock_create_product:
            with patch.object(stripe.Price, "create", return_value=mock_price):
                product_id, price_id = stripe_service.create_product_and_price(
                    name="Test Agent",
                    description="A test agent",
                    price_cents=1000,
                    seller_stripe_account_id=None,
                )

        # Verify metadata has empty seller account
        call_args = mock_create_product.call_args
        assert call_args.kwargs["metadata"]["seller_stripe_account_id"] == ""
        assert product_id == "prod_test456"
        assert price_id == "price_test456"

    def test_create_product_and_price_stripe_error(self, stripe_service):
        """Test handling of Stripe errors during product creation."""
        with patch.object(
            stripe.Product,
            "create",
            side_effect=stripe.StripeError("API Error"),
        ):
            with pytest.raises(stripe.StripeError):
                stripe_service.create_product_and_price(
                    name="Test Agent",
                    description="A test agent",
                    price_cents=500,
                )


# ============== Checkout Session Tests ==============


class TestCreateCheckoutSession:
    """Tests for creating checkout sessions."""

    def test_create_checkout_session_success(self, stripe_service):
        """Test successful checkout session creation."""
        mock_session = MagicMock(url="https://checkout.stripe.com/session123")

        with patch.object(stripe.checkout.Session, "create", return_value=mock_session):
            url = stripe_service.create_checkout_session(
                team_id="team123",
                price_id="price_123",
                success_url="https://example.com/success",
                cancel_url="https://example.com/cancel",
            )

        assert url == "https://checkout.stripe.com/session123"

    def test_create_checkout_session_payment_mode(self, stripe_service):
        """Test checkout session with payment mode."""
        mock_session = MagicMock(url="https://checkout.stripe.com/payment123")

        with patch.object(
            stripe.checkout.Session, "create", return_value=mock_session
        ) as mock_create:
            stripe_service.create_checkout_session(
                team_id="team123",
                price_id="price_123",
                success_url="https://example.com/success",
                cancel_url="https://example.com/cancel",
                mode="payment",
            )

        call_args = mock_create.call_args
        assert call_args.kwargs["mode"] == "payment"

    def test_create_checkout_session_stripe_error(self, stripe_service):
        """Test handling of Stripe errors during checkout."""
        with patch.object(
            stripe.checkout.Session,
            "create",
            side_effect=stripe.StripeError("API Error"),
        ):
            with pytest.raises(stripe.StripeError):
                stripe_service.create_checkout_session(
                    team_id="team123",
                    price_id="price_123",
                    success_url="https://example.com/success",
                    cancel_url="https://example.com/cancel",
                )


class TestCreateMarketplaceCheckoutSession:
    """Tests for marketplace checkout sessions."""

    def test_create_marketplace_checkout_session_success(self, stripe_service):
        """Test successful marketplace checkout session."""
        mock_session = MagicMock(url="https://checkout.stripe.com/marketplace123")

        with patch.object(stripe.checkout.Session, "create", return_value=mock_session):
            url = stripe_service.create_marketplace_checkout_session(
                team_id="team123",
                marketplace_agent_id="agent123",
                price_id="price_123",
                success_url="https://example.com/success",
                cancel_url="https://example.com/cancel",
            )

        assert url == "https://checkout.stripe.com/marketplace123"

    def test_create_marketplace_checkout_with_seller_account(self, stripe_service):
        """Test marketplace checkout with seller Connect account."""
        mock_session = MagicMock(url="https://checkout.stripe.com/connect123")

        with patch.object(
            stripe.checkout.Session, "create", return_value=mock_session
        ) as mock_create:
            stripe_service.create_marketplace_checkout_session(
                team_id="team123",
                marketplace_agent_id="agent123",
                price_id="price_123",
                success_url="https://example.com/success",
                cancel_url="https://example.com/cancel",
                seller_stripe_account_id="acct_seller123",
            )

        call_args = mock_create.call_args
        assert "payment_intent_data" in call_args.kwargs
        assert (
            call_args.kwargs["payment_intent_data"]["transfer_data"]["destination"]
            == "acct_seller123"
        )

    def test_create_marketplace_checkout_metadata(self, stripe_service):
        """Test marketplace checkout includes correct metadata."""
        mock_session = MagicMock(url="https://checkout.stripe.com/meta123")

        with patch.object(
            stripe.checkout.Session, "create", return_value=mock_session
        ) as mock_create:
            stripe_service.create_marketplace_checkout_session(
                team_id="team456",
                marketplace_agent_id="agent789",
                price_id="price_123",
                success_url="https://example.com/success",
                cancel_url="https://example.com/cancel",
            )

        call_args = mock_create.call_args
        metadata = call_args.kwargs["metadata"]
        assert metadata["team_id"] == "team456"
        assert metadata["marketplace_agent_id"] == "agent789"
        assert metadata["type"] == "marketplace_agent_purchase"


# ============== Connect Account Tests ==============


class TestCreateConnectAccount:
    """Tests for Stripe Connect account creation."""

    def test_create_connect_account_success(self, stripe_service):
        """Test successful Connect account creation."""
        mock_account = MagicMock(id="acct_new123")

        with patch.object(stripe.Account, "create", return_value=mock_account):
            account_id = stripe_service.create_connect_account(
                user_id="user123",
                email="seller@example.com",
            )

        assert account_id == "acct_new123"

    def test_create_connect_account_sets_capabilities(self, stripe_service):
        """Test Connect account requests correct capabilities."""
        mock_account = MagicMock(id="acct_cap123")

        with patch.object(stripe.Account, "create", return_value=mock_account) as mock_create:
            stripe_service.create_connect_account(
                user_id="user123",
                email="seller@example.com",
            )

        call_args = mock_create.call_args
        capabilities = call_args.kwargs["capabilities"]
        assert capabilities["card_payments"]["requested"] is True
        assert capabilities["transfers"]["requested"] is True

    def test_create_connect_account_stripe_error(self, stripe_service):
        """Test handling of Stripe errors during account creation."""
        with patch.object(
            stripe.Account,
            "create",
            side_effect=stripe.StripeError("API Error"),
        ):
            with pytest.raises(stripe.StripeError):
                stripe_service.create_connect_account(
                    user_id="user123",
                    email="seller@example.com",
                )


class TestCreateAccountLink:
    """Tests for creating account onboarding links."""

    def test_create_account_link_success(self, stripe_service):
        """Test successful account link creation."""
        mock_link = MagicMock(url="https://connect.stripe.com/onboarding/abc123")

        with patch.object(stripe.AccountLink, "create", return_value=mock_link):
            url = stripe_service.create_account_link(
                account_id="acct_123",
                refresh_url="https://example.com/refresh",
                return_url="https://example.com/return",
            )

        assert url == "https://connect.stripe.com/onboarding/abc123"

    def test_create_account_link_sets_type(self, stripe_service):
        """Test account link uses account_onboarding type."""
        mock_link = MagicMock(url="https://connect.stripe.com/onboarding/type123")

        with patch.object(stripe.AccountLink, "create", return_value=mock_link) as mock_create:
            stripe_service.create_account_link(
                account_id="acct_123",
                refresh_url="https://example.com/refresh",
                return_url="https://example.com/return",
            )

        call_args = mock_create.call_args
        assert call_args.kwargs["type"] == "account_onboarding"


class TestGetAccountStatus:
    """Tests for getting Connect account status."""

    def test_get_account_status_success(self, stripe_service):
        """Test successful account status retrieval."""
        mock_account = MagicMock(
            id="acct_status123",
            charges_enabled=True,
            payouts_enabled=True,
            details_submitted=True,
        )

        with patch.object(stripe.Account, "retrieve", return_value=mock_account):
            status = stripe_service.get_account_status("acct_status123")

        assert status["id"] == "acct_status123"
        assert status["charges_enabled"] is True
        assert status["payouts_enabled"] is True
        assert status["details_submitted"] is True

    def test_get_account_status_incomplete(self, stripe_service):
        """Test account status for incomplete account."""
        mock_account = MagicMock(
            id="acct_incomplete",
            charges_enabled=False,
            payouts_enabled=False,
            details_submitted=False,
        )

        with patch.object(stripe.Account, "retrieve", return_value=mock_account):
            status = stripe_service.get_account_status("acct_incomplete")

        assert status["charges_enabled"] is False
        assert status["payouts_enabled"] is False
        assert status["details_submitted"] is False


# ============== Webhook Tests ==============


class TestConstructWebhookEvent:
    """Tests for webhook event construction."""

    def test_construct_webhook_event_success(self, stripe_service):
        """Test successful webhook event construction."""
        mock_event = MagicMock(type="checkout.session.completed")

        with patch.object(stripe.Webhook, "construct_event", return_value=mock_event):
            event = stripe_service.construct_webhook_event(
                payload=b'{"type": "checkout.session.completed"}',
                signature="test_sig_123",
            )

        assert event.type == "checkout.session.completed"

    def test_construct_webhook_event_invalid_signature(self, stripe_service):
        """Test webhook with invalid signature."""
        with patch.object(
            stripe.Webhook,
            "construct_event",
            side_effect=stripe.SignatureVerificationError("Invalid", "sig"),
        ):
            with pytest.raises(stripe.SignatureVerificationError):
                stripe_service.construct_webhook_event(
                    payload=b'{"type": "test"}',
                    signature="invalid_sig",
                )


class TestRetrieveCheckoutSession:
    """Tests for retrieving checkout sessions."""

    def test_retrieve_checkout_session_success(self, stripe_service):
        """Test successful checkout session retrieval."""
        mock_session = MagicMock(
            id="cs_test123",
            payment_status="paid",
        )

        with patch.object(stripe.checkout.Session, "retrieve", return_value=mock_session):
            session = stripe_service.retrieve_checkout_session("cs_test123")

        assert session.id == "cs_test123"
        assert session.payment_status == "paid"


# ============== Singleton Tests ==============


class TestGetStripeService:
    """Tests for the stripe service singleton."""

    def test_get_stripe_service_returns_instance(self):
        """Test that get_stripe_service returns a StripeService instance."""
        with patch("src.services.stripe_service.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                stripe_secret_key="sk_test_123",
                stripe_webhook_secret="whsec_test_123",
                platform_commission_rate=0.20,
            )
            # Reset singleton
            import src.services.stripe_service as module

            module._stripe_service = None

            service = get_stripe_service()

            assert isinstance(service, StripeService)

    def test_get_stripe_service_singleton(self):
        """Test that get_stripe_service returns the same instance."""
        with patch("src.services.stripe_service.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                stripe_secret_key="sk_test_123",
                stripe_webhook_secret="whsec_test_123",
                platform_commission_rate=0.20,
            )
            # Reset singleton
            import src.services.stripe_service as module

            module._stripe_service = None

            service1 = get_stripe_service()
            service2 = get_stripe_service()

            assert service1 is service2
