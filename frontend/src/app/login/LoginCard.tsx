/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from 'react';
import { Card, Heading, Text, Button, Flex, Checkbox, Box } from '@radix-ui/themes';
import InputField from 'components/fields/InputField';
import { Loader2Icon } from 'lucide-react';
import { getAzureLogin } from 'api/auth';
import { removeLoginParams } from '@/utils/urlUtils';
import Link from 'next/link';
import { OktaIcon } from 'components/icons/OktaIcon';

interface LoginFormInputs {
  email: string;
  password: string;
}

interface LoginCardProps {
  onSubmit: (data: LoginFormInputs) => Promise<void>;
  loading: boolean;
  credentials: LoginFormInputs;
  handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  loginMethod: 'email' | 'microsoft' | 'all';
  setLoginMethod: (method: 'email' | 'microsoft' | 'all') => void;
  setLoading: (loading: boolean) => void;
  authErrorMessage: string;
  setAuthErrorMessage: (message: string) => void;
  nextUrl?: string | null;
  agreeToTerms: boolean;
  setAgreeToTerms: (agree: boolean) => void;
  failedAttempts?: number;
}

const FORGOT_PASSWORD_NUDGE_THRESHOLD = 3;

function LoginCard({
  onSubmit,
  loading,
  credentials,
  handleInputChange,
  loginMethod,
  setLoginMethod,
  setLoading,
  authErrorMessage,
  setAuthErrorMessage,
  nextUrl,
  agreeToTerms,
  setAgreeToTerms,
  failedAttempts = 0,
}: LoginCardProps) {
  // Show terms and condition
  const showTermsCheckbox = process.env.NEXT_PUBLIC_REQUIRE_TERMS_ACCEPTANCE === 'true';
  
  const client = process.env.NEXT_PUBLIC_CLIENT;

  useEffect(() => {
    if (authErrorMessage !== '') setLoginMethod('all');
  }, [authErrorMessage, setLoginMethod]);

  const requireTermsOrBail = () => {
    // Only check terms if the feature is enabled
    if (showTermsCheckbox && !agreeToTerms) {
      setAuthErrorMessage('Please agree to Terms and Conditions to continue.');
      setLoginMethod('all');
      return false;
    }
    return true;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requireTermsOrBail()) return;
    setLoginMethod('email');
    onSubmit(credentials);
  };

  const handleMicrosoftLogin = async () => {
    if (!requireTermsOrBail()) return;
    try {
      setLoginMethod('microsoft');
      setLoading(true);

      if (nextUrl) {
        const cleanedNextUrl = removeLoginParams(nextUrl);
        localStorage.setItem('auth_next_url', cleanedNextUrl);
      }

      const azureLoginResponse = await getAzureLogin();
      window.location.href = azureLoginResponse.authRedirectURL;
    } catch (error) {
      setLoginMethod('all');
      setLoading(false);
      const clientName = client === 'fme' ? 'Okta' : 'Microsoft';
      setAuthErrorMessage(`${clientName} Login failed`);
    }
  };

  return (
    <Card
      size="3"
      className="h-max max-w-[405px] bg-white px-4 py-2.5 pt-8 md:w-[510px] md:max-w-[510px] md:!p-[50px] md:pt-[50px]"
    >
      {(loginMethod === 'email' || loginMethod === 'all') && (
        <>
          <Heading
            as="h3"
            size="8"
            weight="bold"
            trim="both"
            style={{ color: 'var(--gray-12)' }}
            mb="3"
          >
            Sign In
          </Heading>
          <Text style={{ color: 'var(--gray-8)' }} ml="1" mb="4">
            Enter your email and password to sign in!
          </Text>

          {/* — Terms block — */}

          <form onSubmit={handleSubmit}>
            <InputField
              label="Email*"
              placeholder="mail@example.com"
              id="email"
              name="email"
              type="email"
              value={credentials.email}
              onChange={handleInputChange}
            />
            <InputField
              label="Password*"
              placeholder="Enter your password"
              id="password"
              name="password"
              type="password"
              value={credentials.password}
              onChange={handleInputChange}
            />
            <Flex justify="end" mb="3">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                Forgot password?
              </Link>
            </Flex>
            {failedAttempts >= FORGOT_PASSWORD_NUDGE_THRESHOLD ? (
              <Flex
                align="start"
                gap="2"
                mb="4"
                p="3"
                style={{
                  borderRadius: '12px',
                  border: '1px solid #FCD9C8',
                  background: '#FFF6EE',
                }}
              >
                <Text size="2" style={{ color: '#9A3412' }}>
                  Having trouble signing in?{' '}
                  <Link
                    href="/forgot-password"
                    className="font-semibold text-[#7358FF] hover:text-[#5E45E0] underline"
                  >
                    Reset your password
                  </Link>{' '}
                  and we&apos;ll email you a fresh link.
                </Text>
              </Flex>
            ) : null}
            {/* Terms and Privacy Agreement - Only show if environment variable is set */}
            {showTermsCheckbox && (
              <Flex direction="column" gap="1" mb="4">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox 
                    className={'mt-1'} 
                    checked={agreeToTerms} 
                    onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)} 
                  />
                  <Text size="3" style={{ color: 'var(--gray-11)' }}>
                    🔐 I have read and agree to the{' '}
                    <Link 
                      href="/terms" 
                      target="_blank" 
                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      Terms &amp; Conditions
                    </Link>
                    .
                  </Text>
                </label>
              </Flex>
            )}
           
            <Button
              variant="solid"
              className="mt-4 w-full cursor-pointer"
              type="submit"
              disabled={loading || (showTermsCheckbox && !agreeToTerms)}
            >
              Sign In
              {loading && <Loader2Icon className="animate-spin" />}
            </Button>
          </form>
        </>
      )}

      {!!authErrorMessage && (
        <div className="mt-3 text-center text-sm text-red-600" role="alert">
          {authErrorMessage}
        </div>
      )}

      {loginMethod === 'all' && (
        <Flex align="center" justify="center" className="my-8 h-px w-full bg-coolGrey-300">
          <Text className="bg-white px-2">or</Text>
        </Flex>
      )}

      {(loginMethod === 'microsoft' || loginMethod === 'all') && (
        <Flex direction="column" gap="4">
          <Button
            size="3"
            disabled={loading || (showTermsCheckbox && !agreeToTerms)}
            radius="small"
            variant="outline"
            color="gray"
            className="cursor-pointer"
            onClick={handleMicrosoftLogin}
          >
            {client === 'fme' ? (
              <OktaIcon width={20} height={20} style={{ marginRight: 10 }} />
            ) : (
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg"
                alt="Microsoft Logo"
                style={{ height: 20, marginRight: 10 }}
              />
            )}
            {client === 'fme' ? 'Sign in with Okta' : 'Sign in with Microsoft'}
            {loading && <Loader2Icon className="animate-spin" />}
          </Button>
        </Flex>
      )}
    </Card>
  );
}

export default LoginCard;
